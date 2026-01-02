"use client";
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function Home() {
  const [myPeerId, setMyPeerId] = useState('');
  const [peers, setPeers] = useState<Record<string, any>>({});
  const [status, setStatus] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  
  const peerRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  const CHUNK_SIZE = 16384;

  useEffect(() => {
    let isMounted = true;
    const initP2P = async () => {
      try {
        const { default: Peer } = await import('peerjs');
        const p = new Peer({
          config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }
        });
        peerRef.current = p;

        p.on('open', (id) => {
          if (!isMounted) return;
          setMyPeerId(id);
          setStatus('Ready');
          const socket = io();
          socketRef.current = socket;
          socket.emit('discovery', { 
            peerId: id, 
            name: /android/i.test(navigator.userAgent) ? "Android" : "Windows", 
            color: `hsl(${Math.random() * 360}, 70%, 50%)` 
          });

          socket.on('peer-found', (data) => {
            socket.emit('signal-exchange', { to: data.socketId, peerId: id, name: "PC", color: "#3b82f6" });
            setPeers(prev => ({ ...prev, [data.socketId]: data }));
          });

          socket.on('got-peer', (data) => setPeers(prev => ({ ...prev, [data.from]: data })));
          socket.on('peer-left', (sid) => setPeers(prev => { const n = { ...prev }; delete n[sid]; return n; }));
        });

        
        p.on('connection', (conn) => {
          let receivedChunks: any[] = [];
          conn.on('data', (data: any) => {
            if (data.type === 'start') {
              setIsTransferring(true);
              receivedChunks = [];
              setProgress(0);
            } else if (data.type === 'chunk') {
              receivedChunks.push(data.chunk);
              setProgress(Math.round((receivedChunks.length * CHUNK_SIZE / data.total) * 100));
            } else if (data.type === 'end') {
              const blob = new Blob(receivedChunks);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = data.name;
              a.click();
              setIsTransferring(false);
              setProgress(0);
            }
          });
        });
      } catch (e) { setStatus('P2P Error'); }
    };
    initP2P();
    return () => { socketRef.current?.disconnect(); peerRef.current?.destroy(); };
  }, []);


  const sendFile = (targetPid: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const conn = peerRef.current.connect(targetPid, { reliable: true });
      conn.on('open', () => {
        setIsTransferring(true);
        setStatus('Sending...');
        conn.send({ type: 'start', name: file.name, total: file.size });

        let offset = 0;
        const reader = new FileReader();

        const readNextChunk = () => {
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          reader.readAsArrayBuffer(slice);
        };

        reader.onload = (event: any) => {
          conn.send({ type: 'chunk', chunk: event.target.result, total: file.size });
          offset += event.target.result.byteLength;
          setProgress(Math.round((offset / file.size) * 100));

          if (offset < file.size) {
            readNextChunk();
          } else {
            conn.send({ type: 'end', name: file.name });
            setIsTransferring(false);
            setStatus('Ready');
            setProgress(0);
          }
        };

        readNextChunk();
      });
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
        
        {isTransferring && (
          <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-24 h-24 rounded-full border-4 border-zinc-800 flex items-center justify-center mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 transition-all duration-300" style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}></div>
              <span className="text-xl font-black">{progress}%</span>
            </div>
            <p className="font-bold text-sm tracking-widest text-blue-400">TRANSFERRING</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-black italic">Sendr</h1>
          <div className={`h-2 w-2 rounded-full ${myPeerId ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <div className="space-y-4">
          {Object.entries(peers).map(([sid, info]: [string, any]) => (
            <div key={sid} className="flex items-center justify-between p-4 bg-zinc-800 rounded-[2rem] border border-zinc-700">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: info?.color }}>
                  {info?.name?.[0]}
                </div>
                <p className="font-bold text-sm">{info?.name}</p>
              </div>
              <button onClick={() => sendFile(info.peerId)} className="bg-blue-600 text-white px-5 py-2 rounded-2xl font-black text-xs">
                SEND
              </button>
            </div>
          ))}

          {Object.keys(peers).length === 0 && (
            <div className="py-16 text-center border-2 border-dashed border-zinc-800 rounded-[2rem]">
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-tighter">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}