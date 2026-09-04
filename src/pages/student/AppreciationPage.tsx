import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Heart, Send, MessageCircle, Sparkles, UserCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import { getLocalStorage, setLocalStorage } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTeachers } from '../../hooks/useTeachers';
import { useAuthContext } from '../../contexts/AuthContext';
import type { AppreciationMessage } from '../../types';

const cardColors = [
  'border-l-primary-500/50',
  'border-l-rose-500/50',
  'border-l-gold-500/50',
  'border-l-emerald-500/50',
  'border-l-violet-500/50',
  'border-l-cyan-500/50',
];

export default function AppreciationPage() {
  const [messages, setMessages] = useState<AppreciationMessage[]>(() => getLocalStorage<AppreciationMessage[]>('td_admin_messages', []));
  const [message, setMessage] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { teachers } = useTeachers();
  const { user } = useAuthContext();
  const maxLength = 280;

  const areMessagesEqual = (a: AppreciationMessage[], b: AppreciationMessage[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || a[i].status !== b[i].status) return false;
    }
    return true;
  };

  const fetchMessages = useCallback(async () => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const local = getLocalStorage<AppreciationMessage[]>('td_admin_messages', []);
      return local.filter((m) => m.status === 'approved' || m.status === 'featured');
    });

    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('appreciation_messages')
        .select('*, teacher:teachers(name)')
        .in('status', ['approved', 'featured'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const fresh = data as AppreciationMessage[];
        setMessages((prev) => (areMessagesEqual(prev, fresh) ? prev : fresh));
        setLocalStorage('td_admin_messages', data);
      }
    } catch {
      // Keep local
    }
  }, []);

  useEffect(() => {
    fetchMessages();

    const handleUpdate = () => {
      fetchMessages();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };

    window.addEventListener('td_appreciation_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('td_appreciation_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMessages]);

  // Real-time subscription to new appreciation messages
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('appreciation_wall_live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appreciation_messages',
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const handleSubmit = async () => {
    if (!message.trim() || message.length > maxLength) return;

    setIsSubmitting(true);
    try {
      const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
      const studentIdentifier = user?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '33333333-0000-0000-0000-000000000001');

      const newMsg: AppreciationMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        student_id: studentIdentifier,
        teacher_id: selectedTeacherId || undefined,
        teacher: selectedTeacher || undefined,
        message: message.trim(),
        status: 'approved', // Auto-approved for real-time display
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const allMessages = getLocalStorage<AppreciationMessage[]>('td_admin_messages', []);
      const updated = [newMsg, ...allMessages];
      setLocalStorage('td_admin_messages', updated);
      window.dispatchEvent(new Event('td_appreciation_updated'));

      if (isSupabaseConfigured) {
        try {
          await supabase.from('appreciation_messages').insert({
            student_id: studentIdentifier.includes('-') && studentIdentifier.length === 36 ? studentIdentifier : null,
            message: message.trim(),
            teacher_id: selectedTeacherId || null,
            status: 'approved',
          });
        } catch {
          // Handled locally
        }
      }

      toast.success('Message Published!', 'Thank you for sharing your appreciation.');
      setMessage('');
      setSelectedTeacherId('');
      fetchMessages();
    } catch {
      toast.error('Submission Failed', 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="section-title flex items-center gap-2">
          <Heart className="text-rose-400" size={24} />
          Appreciation Wall
        </h1>
        <p className="section-subtitle">
          Share your gratitude — messages are real-time, celebrated and cherished
        </p>
      </motion.div>

      {/* Submit Message */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a heartfelt message for your teachers..."
                maxLength={maxLength}
                rows={3}
                className="w-full bg-transparent text-sm text-surface-100 placeholder:text-surface-500 resize-none focus:outline-none border-b border-surface-700/60 pb-2"
                aria-label="Appreciation message"
              />

              {/* Teacher selector (optional) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={14} className="text-surface-400" />
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="bg-surface-900 border border-surface-700/70 rounded-lg px-2.5 py-1 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Dedicate to (All Teachers / General)</option>
                    {[...teachers]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.department}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className={`text-xs ${
                    message.length > maxLength * 0.9
                      ? 'text-rose-400'
                      : 'text-surface-500'
                  }`}>
                    {message.length}/{maxLength}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmit}
                    isLoading={isSubmitting}
                    disabled={!message.trim() || message.length > maxLength}
                    icon={<Send size={14} />}
                  >
                    Submit Note
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Messages Wall */}
      {messages.length === 0 ? (
        <Card className="p-8 text-center text-surface-400 text-sm">
          No appreciation messages posted yet. Be the first to share a heartfelt note for your teachers!
        </Card>
      ) : (
        <div className="columns-1 sm:columns-2 gap-3 space-y-3">
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04 }}
              className="break-inside-avoid"
            >
              <Card
                variant="flat"
                padding="none"
                className={`border-l-4 ${cardColors[index % cardColors.length]}`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {msg.status === 'featured' && (
                      <Badge variant="gold" icon={<Sparkles size={10} />}>
                        Featured
                      </Badge>
                    )}
                    {msg.teacher?.name && (
                      <span className="text-[11px] font-semibold text-primary-300">
                        To: {msg.teacher.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-200 leading-relaxed italic">
                    "{msg.message}"
                  </p>
                  <p className="text-[10px] text-surface-500 mt-3">
                    {new Date(msg.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
