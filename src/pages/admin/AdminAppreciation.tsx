import { useState, useEffect, useCallback } from 'react';
import { MessageSquareHeart, CheckCircle2, XCircle, Sparkles, Trash2, Search, RefreshCw, Eraser } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../../lib/utils';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';
import type { AppreciationMessage, MessageStatus } from '../../types';

export default function AdminAppreciation() {
  const { logAction } = useAdmin();
  const [messages, setMessages] = useState<AppreciationMessage[]>(() => getLocalStorage<AppreciationMessage[]>('td_admin_messages', []));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchMessages = useCallback(async () => {
    const local = getLocalStorage<AppreciationMessage[]>('td_admin_messages', []);
    setMessages(local);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const queryPromise = supabase
        .from('appreciation_messages')
        .select(`*, teacher:teachers(name)`)
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Messages fetch timeout')), 2500)
      );

      const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

      if (error) throw error;
      if (data) {
        setMessages(data as AppreciationMessage[]);
        setLocalStorage('td_admin_messages', data);
      }
    } catch {
      // Keep local messages
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();

    const handleUpdate = () => {
      fetchMessages();
    };

    window.addEventListener('td_appreciation_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // 10-second regular database polling loop
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('td_appreciation_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchMessages]);

  const handleUpdateStatus = async (id: string, newStatus: MessageStatus) => {
    const updated = messages.map((m) =>
      m.id === id ? { ...m, status: newStatus, updated_at: new Date().toISOString() } : m
    );
    setMessages(updated);
    setLocalStorage('td_admin_messages', updated);
    window.dispatchEvent(new Event('td_appreciation_updated'));
    toast.success(`Message marked as ${newStatus}`);
    await logAction(`Appreciation Message Status Updated to ${newStatus}`);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('appreciation_messages')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch {
        // Handled locally
      }
    }
  };

  const handleDelete = async (id: string) => {
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    setLocalStorage('td_admin_messages', updated);
    window.dispatchEvent(new Event('td_appreciation_updated'));
    toast.warning('Message Deleted');
    await logAction('Appreciation Message Deleted');

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('appreciation_messages')
          .delete()
          .eq('id', id);
      } catch {
        // Handled locally
      }
    }
  };

  const handleClearAllMessages = async () => {
    setIsClearing(true);
    setMessages([]);
    setLocalStorage('td_admin_messages', []);
    window.dispatchEvent(new Event('td_appreciation_updated'));
    await logAction('Cleared All Appreciation Messages');

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('appreciation_messages')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // Handled locally
      }
    }

    setIsClearing(false);
    setShowClearConfirm(false);
    toast.success('Appreciation Wall Cleared', 'All mock & demo messages have been removed.');
  };

  const filteredMessages = messages.filter((m) => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesSearch = m.message.toLowerCase().includes(search.toLowerCase()) ||
      (m.teacher?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <MessageSquareHeart className="text-rose-400" size={24} />
            Appreciation Wall Moderation
          </h1>
          <p className="section-subtitle">
            Review, approve, feature, or reject real-time student appreciation notes ({messages.length} notes)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => fetchMessages()}
          >
            Refresh
          </Button>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<Eraser size={14} className="text-rose-400" />}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All Messages
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['all', 'pending', 'approved', 'featured', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap tap-target ${
                statusFilter === status
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-sm'
                  : 'bg-surface-800/60 text-surface-400 border border-surface-700/50 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={14} />}
          />
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredMessages.length === 0 ? (
        <Card className="p-8 text-center text-surface-400 text-sm">
          No appreciation messages found. Real-time messages submitted by students will appear here instantly!
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => (
            <Card key={msg.id} variant="default">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        msg.status === 'approved'
                          ? 'success'
                          : msg.status === 'featured'
                          ? 'gold'
                          : msg.status === 'rejected'
                          ? 'danger'
                          : 'neutral'
                      }
                    >
                      {msg.status.toUpperCase()}
                    </Badge>
                    {msg.teacher?.name && (
                      <span className="text-xs text-primary-300 font-medium">
                        For: {msg.teacher.name}
                      </span>
                    )}
                    <span className="text-[10px] text-surface-500">
                      {new Date(msg.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <p className="text-sm text-surface-100 italic leading-relaxed">
                    "{msg.message}"
                  </p>
                </div>

                {/* Moderation Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  {msg.status !== 'approved' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<CheckCircle2 size={14} className="text-emerald-400" />}
                      onClick={() => handleUpdateStatus(msg.id, 'approved')}
                    >
                      Approve
                    </Button>
                  )}

                  {msg.status !== 'featured' && (
                    <Button
                      variant="gold"
                      size="sm"
                      icon={<Sparkles size={14} />}
                      onClick={() => handleUpdateStatus(msg.id, 'featured')}
                    >
                      Feature
                    </Button>
                  )}

                  {msg.status !== 'rejected' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<XCircle size={14} className="text-rose-400" />}
                      onClick={() => handleUpdateStatus(msg.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} className="text-surface-500 hover:text-rose-400" />}
                    onClick={() => handleDelete(msg.id)}
                    aria-label="Delete message"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllMessages}
        title="Clear Appreciation Wall"
        message="Are you sure you want to clear all appreciation messages?"
        warning="This will permanently remove all demo and posted notes from the moderation panel and appreciation wall."
        confirmText="Clear All Messages"
        cancelText="Cancel"
        variant="danger"
        isLoading={isClearing}
      />
    </div>
  );
}
