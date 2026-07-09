import { GameRoom } from "../types";
import { Copy, Share2, Users, RefreshCw, LogOut, ShieldAlert, Check, Clock, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import QRCode from "qrcode";

interface RoomLobbyProps {
  room: GameRoom;
  playerId: string;
  onLeave: () => void;
  onUpdateSettings?: (isTimed: boolean, duration: number) => void;
}

export default function RoomLobby({ room, playerId, onLeave, onUpdateSettings }: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Construct sharing link
  const joinUrl = `${window.location.origin}?room=${room.roomId}`;

  useEffect(() => {
    QRCode.toDataURL(
      joinUrl,
      {
        margin: 1,
        width: 250,
        color: {
          dark: "#10b981", // Emerald-500
          light: "#020617", // slate-950 background
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
          <div className="relative p-3 bg-slate-950 border border-emerald-500/20 rounded-xl mb-4 shadow-[0_0_15px_rgba(16,185,129,0.05)] flex items-center justify-center min-w-[144px] min-h-[144px]">
            {qrCodeUrl ? (
              <div className="relative flex items-center justify-center">
                <img
                  src={qrCodeUrl}
                  alt="Scan to join match"
                  className="w-36 h-36 select-none animate-fade-in rounded-lg border border-emerald-500/10"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute w-8 h-8 rounded bg-slate-950 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-tighter">DI</span>
                </div>
              </div>
            ) : (
              <div className="w-36 h-36 bg-slate-950 animate-pulse rounded-lg" />
            )}
          </div>

          <p className="text-[10px] font-mono text-slate-400 max-w-xs px-6 uppercase tracking-tight leading-normal">
            SCAN OR SHARE THE LINK BELOW TO BRING YOUR OPPONENT INTO THE MATCH
          </p>
        </div>

        {/* Match Configuration */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 mb-6">
          <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            MATCH CONFIGURATION
          </h3>

          {room.players[0]?.id === playerId ? (
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => onUpdateSettings?.(false, room.timerDuration ?? 60)}
                  className={`flex-1 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    !(room.isTimed ?? false)
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  Untimed (Unlimited)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings?.(true, room.timerDuration ?? 60)}
                  className={`flex-1 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    (room.isTimed ?? false)
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  Timed Guess
                </button>
              </div>

              {(room.isTimed ?? false) && (
                <div className="space-y-2">
                  <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    TIME PER TURN
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "30s", val: 30 },
                      { label: "1 Min", val: 60 },
                      { label: "2 Min", val: 120 },
                      { label: "3 Min", val: 180 },
                      { label: "4 Min", val: 240 },
                      { label: "5 Min", val: 300 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => onUpdateSettings?.(true, opt.val)}
                        className={`py-1 rounded border font-mono text-[10px] font-medium transition-all cursor-pointer ${
                          (room.timerDuration ?? 60) === opt.val
                            ? "bg-emerald-950/50 border-emerald-500 text-emerald-400"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-900 rounded-lg">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                  GAME RULES
                </span>
                <span className="text-xs font-mono text-slate-200 font-bold uppercase">
                  {(room.isTimed ?? false) ? `TIMED (${(room.timerDuration ?? 60) >= 60 ? `${(room.timerDuration ?? 60) / 60}m` : `${room.timerDuration ?? 60}s`} PER TURN)` : "UNTIMED (UNLIMITED TIME)"}
                </span>
              </div>
            </div>
          )}
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
                  {p.id === playerId ? "CREATOR (YOU)" : "OPPONENT"}
                </span>
              </div>
            ))}

            {room.players.length < 2 && (
              <div className="flex items-center justify-between p-3 border border-dashed border-slate-900 rounded-xl bg-slate-950/10">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="font-mono text-xs text-slate-600 uppercase tracking-wider">
                    AWAITING OPPONENT...
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
