import { useNavigate } from 'react-router-dom';
import { Presentation, ExternalLink, ShieldCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../lib/constants';

export default function AdminEventMode() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Presentation className="text-gold-400" size={24} />
          Event Mode & Projector Controller
        </h1>
        <p className="section-subtitle">
          Full-screen award reveal presentation designed for projector screens during Teachers' Day ceremony
        </p>
      </div>

      <Card className="border-l-4 border-l-gold-500 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Full-Screen Projector Mode</h2>
            <p className="text-xs text-surface-400 mt-1 max-w-lg">
              Launches an ultra-clean 16:9 full-screen experience with large typography, candidate photos, smooth reveal transitions, and interactive podium announcements.
            </p>
          </div>

          <Button
            variant="gold"
            size="lg"
            icon={<ExternalLink size={18} />}
            onClick={() => navigate(ROUTES.EVENT_MODE)}
          >
            ENTER EVENT MODE
          </Button>
        </div>
      </Card>

      <Card variant="flat" className="space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" size={16} />
          Presentation Controls & Keyboard Shortcuts
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-surface-300">
          <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/50">
            <span className="font-bold text-white block mb-1">Spacebar / Right Arrow</span>
            Advance to next stage (Category Announcement → 1st Place Winner Reveal → Next Award).
          </div>
          <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/50">
            <span className="font-bold text-white block mb-1">Left Arrow</span>
            Step back to previous reveal stage.
          </div>
          <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/50">
            <span className="font-bold text-white block mb-1">Escape (Esc)</span>
            Exit Event Mode and return to Admin Dashboard.
          </div>
        </div>
      </Card>
    </div>
  );
}
