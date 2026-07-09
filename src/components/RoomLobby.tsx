import { GameRoom } from "../types";
import { Copy, Share2, Users, RefreshCw, LogOut, ShieldAlert, Check } from "lucide-react";
import { useState, useEffect } from "react";
import QRCode from "qrcode";

interface RoomLobbyProps {
  room: GameRoom;
  playerId: string;
  onLeave: () => void;
}

export default function RoomLobby({ room, playerId, onLeave }: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Construct sharing link
  const joinUrl = `${window.location.origin}?room=${room.roomId}`;

  useEffect(() => {
    QRCode.toDataURL(
      joinUrl,
      {
        margin: 2,
        width: 250,
        color: {
          dark: "#0f172a", // slate-900
          light: "#ffffff",
        },
      },
      (err, url) => {
        if (!err) {
          setQrCodeUrl(url);
        } else {
          console.error("QR Generation error", err);
        }
      }
    );
  }, [joinUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Dead or Injured match!",
          text: "Let's battle in Dead or Injured. Break my code first to win!",
          url: joinUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (e) {
        // Fallback to copy
        handleCopyLink();
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[70vh]">
      {/* Lobby card */}
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">
              MATCHMAKING LOBBY
            </h2>
          </div>
          <button
            onClick={onLeave}
            className="text-xs font-mono text-slate-500 hover:text-slate-300 uppercase flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> LEAVE
          </button>
        </div>

        {/* Big Code and QR */}
        <div className="flex flex-col items-center text-center py-4 bg-slate-950/40 border border-slate-900 rounded-xl mb-6">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            ROOM ACCESS CODE
          </p>
          <h1 className="text-4xl font-mono font-extrabold tracking-widest text-emerald-400 mt-1 mb-4">
            {room.roomId}
          </h1>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-xl mb-4 shadow-lg border-2 border-emerald-500/20 flex items-center justify-center min-w-[144px] min-h-[144px]">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Scan to join match"
                className="w-36 h-36 select-none animate-fade-in"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-lg" />
            )}
          </div>

          <p className="text-[10px] font-mono text-slate-400 max-w-xs px-6 uppercase tracking-tight leading-normal">
            SCAN OR SHARE THE LINK BELOW TO BRING YOUR OPPONENT INTO THE MATCH
          </p>
        </div>

        {/* Connected Users Status */}
        <div className="space-y-3 mb-6">
          <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            CO-CONNECTED SIGNALS
          </h3>

          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-sm font-medium text-slate-200">{p.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  {p.id === playerId ? "CREATOR (YOU)" : "TACTICAL THREAT"}
                </span>
              </div>
            ))}

            {room.players.length < 2 && (
              <div className="flex items-center justify-between p-3 border border-dashed border-slate-900 rounded-xl bg-slate-950/10">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="font-mono text-xs text-slate-600 uppercase tracking-wider">
                    AWAITING TARGET COORDINATES...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sharing/Copy Options */}
        <div className="flex gap-3">
          <button
            onClick={handleCopyLink}
            className="flex-1 h-11 border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-mono text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">COPIED LINK!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>COPY MATCH LINK</span>
              </>
            )}
          </button>

          <button
            onClick={handleShareLink}
            className="flex-1 h-11 border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 font-mono text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_10px_rgba(16,185,129,0.05)]"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{shared ? "SHARED!" : "SHARE LINK"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
