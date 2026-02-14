'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getClientDb } from '@/lib/firebase/client';
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseWebRTCReturn {
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'new';
  cleanup: () => void;
}

/**
 * Delete all WebRTC signaling documents for a duel.
 * Called once the P2P connection is established, and on unmount.
 */
async function cleanupSignaling(duelId: string): Promise<void> {
  const db = getClientDb();
  const duelRef = doc(db, 'duels', duelId);

  // Delete offer and answer docs
  try {
    await deleteDoc(doc(duelRef, 'webrtc', 'offer'));
  } catch { /* may not exist */ }
  try {
    await deleteDoc(doc(duelRef, 'webrtc', 'answer'));
  } catch { /* may not exist */ }

  // Delete all ICE candidate docs in both subcollections
  for (const sub of ['hostCandidates', 'guestCandidates']) {
    try {
      const snap = await getDocs(collection(duelRef, sub));
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
    } catch { /* may not exist */ }
  }
}

export function useWebRTC(
  duelId: string | null,
  isHost: boolean | null,
  localStream: MediaStream | null,
): UseWebRTCReturn {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'new'>('new');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const cleanedUpRef = useRef(false);
  const signalingStartedRef = useRef(false);

  // Stable cleanup function
  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    // Unsubscribe all Firestore listeners
    unsubsRef.current.forEach((unsub) => unsub());
    unsubsRef.current = [];

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Clean up Firestore signaling docs
    if (duelId) {
      cleanupSignaling(duelId).catch(() => {});
    }

    setRemoteStream(null);
    setConnectionState('new');
  }, [duelId]);

  useEffect(() => {
    // Don't start until we have all required info
    if (!duelId || isHost === null || !localStream) return;
    // Prevent double-start
    if (signalingStartedRef.current) return;
    signalingStartedRef.current = true;
    cleanedUpRef.current = false;

    const db = getClientDb();
    const duelRef = doc(db, 'duels', duelId);

    // Create peer connection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Remote stream container (created lazily on first track)
    remoteStreamRef.current = new MediaStream();

    // When we get remote tracks, add them and expose via state
    pc.ontrack = (event) => {
      const remote = remoteStreamRef.current;
      if (!remote) return;
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
      // Force re-render with new stream reference so the video element updates
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        // Clean up signaling data from Firestore
        cleanupSignaling(duelId).catch(() => {});
      }
    };

    // Add local tracks to the connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // ----- ICE candidate handling -----
    const myCandidatesSub = isHost ? 'hostCandidates' : 'guestCandidates';
    const theirCandidatesSub = isHost ? 'guestCandidates' : 'hostCandidates';

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(duelRef, myCandidatesSub), event.candidate.toJSON()).catch(() => {});
      }
    };

    // Listen for the other side's ICE candidates
    const unsubCandidates = onSnapshot(
      collection(duelRef, theirCandidatesSub),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.candidate) {
              pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
            }
          }
        });
      },
    );
    unsubsRef.current.push(unsubCandidates);

    // ----- SDP signaling -----
    if (isHost) {
      // HOST: create offer, write it, then listen for answer
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await setDoc(doc(duelRef, 'webrtc', 'offer'), {
            sdp: offer.sdp,
            type: offer.type,
            createdAt: new Date().toISOString(),
          });

          // Listen for answer
          const unsubAnswer = onSnapshot(
            doc(duelRef, 'webrtc', 'answer'),
            (snapshot) => {
              if (snapshot.exists() && !pc.currentRemoteDescription) {
                const data = snapshot.data();
                pc.setRemoteDescription(
                  new RTCSessionDescription({ sdp: data.sdp, type: data.type }),
                ).catch(() => {});
              }
            },
          );
          unsubsRef.current.push(unsubAnswer);
        } catch (err) {
          console.error('[WebRTC] Host signaling error:', err);
        }
      })();
    } else {
      // GUEST: listen for offer, create answer
      const unsubOffer = onSnapshot(
        doc(duelRef, 'webrtc', 'offer'),
        async (snapshot) => {
          if (!snapshot.exists()) return;
          if (pc.currentRemoteDescription) return;

          try {
            const data = snapshot.data();
            await pc.setRemoteDescription(
              new RTCSessionDescription({ sdp: data.sdp, type: data.type }),
            );

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await setDoc(doc(duelRef, 'webrtc', 'answer'), {
              sdp: answer.sdp,
              type: answer.type,
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error('[WebRTC] Guest signaling error:', err);
          }
        },
      );
      unsubsRef.current.push(unsubOffer);
    }

    // Cleanup on unmount
    return () => {
      // Unsubscribe listeners but don't full-cleanup yet
      // (full cleanup is called explicitly or on unmount)
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      signalingStartedRef.current = false;
      // Clean signaling docs on unmount
      cleanupSignaling(duelId).catch(() => {});
    };
  }, [duelId, isHost, localStream]);

  return { remoteStream, connectionState, cleanup };
}
