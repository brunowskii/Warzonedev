import React from 'react';
import { Check, X, Clock, Eye, Image as ImageIcon } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { PendingSubmission } from '../types';

interface PendingSubmissionsProps {
  submissions: PendingSubmission[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function PendingSubmissions({ 
  submissions, 
  onApprove, 
  onReject 
}: PendingSubmissionsProps) {
  const [selectedPhotos, setSelectedPhotos] = React.useState<string[]>([]);
  const [showPhotoModal, setShowPhotoModal] = React.useState(false);

  const viewPhotos = (photos: string[]) => {
    setSelectedPhotos(photos);
    setShowPhotoModal(true);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (submissions.length === 0) {
    return (
      <GlassPanel className="p-6 text-center">
        <div className="text-ice-blue/60 font-mono">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>NESSUNA SOTTOMISSIONE IN ATTESA</p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <>
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-white mb-6 font-mono flex items-center space-x-2">
          <Clock className="w-5 h-5 text-ice-blue" />
          <span>SOTTOMISSIONI IN ATTESA ({submissions.length})</span>
        </h3>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg animate-fade-in hover:bg-ice-blue/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-white font-bold font-mono">
                    {submission.teamName}
                  </div>
                  <div className="text-ice-blue/60 text-sm font-mono">
                    {submission.teamCode} • {submission.section}
                    {submission.lobby && ` • ${submission.lobby}`}
                  </div>
                </div>
                <div className="text-ice-blue/60 text-sm font-mono">
                  {formatTime(submission.submittedAt)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm font-mono">
                <div className="bg-black/30 p-3 rounded-lg">
                  <div className="text-ice-blue/60">POSIZIONE</div>
                  <div className="text-white font-bold text-lg">
                    {submission.position}°
                  </div>
                </div>
                <div className="bg-black/30 p-3 rounded-lg">
                  <div className="text-ice-blue/60">KILLS</div>
                  <div className="text-white font-bold text-lg">
                    {submission.kills}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => viewPhotos(submission.photos)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-mono text-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>VEDI FOTO ({submission.photos.length})</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    onClick={() => onReject(submission.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300 hover:scale-105 font-mono"
                  >
                    <X className="w-4 h-4" />
                    <span>RIFIUTA</span>
                  </button>
                  <button
                    onClick={() => onApprove(submission.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition-all duration-300 hover:scale-105 font-mono"
                  >
                    <Check className="w-4 h-4" />
                    <span>APPROVA</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <GlassPanel className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
                  <ImageIcon className="w-5 h-5 text-ice-blue" />
                  <span>FOTO SOTTOMISSIONE</span>
                </h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-ice-blue/60 hover:text-ice-blue transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-64 object-cover rounded-lg border border-ice-blue/30"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-sm px-3 py-1 rounded font-mono">
                      FOTO {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </>
  );
}