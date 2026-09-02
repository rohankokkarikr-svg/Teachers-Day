import { useState, useEffect, useCallback, useRef } from 'react';
import { GraduationCap, Plus, Search, Edit2, CheckCircle2, XCircle, Trash2, Upload, Image as ImageIcon, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { getInitials, getLocalStorage, setLocalStorage } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';
import type { Teacher } from '../../types';

const INITIAL_TEACHERS: Teacher[] = [
  { id: '22222222-0000-0000-0000-000000000001', name: 'Dr. Priya Sharma', department: 'Computer Science', subject: 'Data Structures & Algorithms', tagline: 'Making algorithms intuitive and fun!', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000002', name: 'Prof. Rajesh Kumar', department: 'Mathematics', subject: 'Linear Algebra & Calculus', tagline: 'Numbers tell stories if you listen closely.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000003', name: 'Dr. Ananya Desai', department: 'Physics', subject: 'Quantum Mechanics', tagline: 'Exploring the mysteries of the universe.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000004', name: 'Prof. Vikram Singh', department: 'English Literature', subject: 'Modern Communication', tagline: 'Words have the power to change minds.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000005', name: 'Dr. Meera Patel', department: 'Chemistry', subject: 'Organic Chemistry', tagline: 'Chemistry is in everything around us.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000006', name: 'Prof. Arjun Nair', department: 'Electronics', subject: 'Digital System Design', tagline: 'Building tomorrow hardware today.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000007', name: 'Dr. Sunita Rao', department: 'Biotechnology', subject: 'Genetic Engineering', tagline: 'Unraveling the code of life.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000008', name: 'Prof. Kabir Verma', department: 'Mechanical Eng.', subject: 'Thermodynamics', tagline: 'Engineering efficiency in motion.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
];

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>(() => getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_TEACHERS));
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Partial<Teacher> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { saveTeacher, deleteTeacher } = useAdmin();

  // Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [tagline, setTagline] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchTeachers = useCallback(async () => {
    const local = getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_TEACHERS);
    setTeachers(local);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const queryPromise = supabase
        .from('teachers')
        .select('*')
        .order('name');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Teachers fetch timeout')), 2500)
      );

      const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

      if (error) throw error;
      if (data && data.length > 0) {
        setTeachers(data as Teacher[]);
        setLocalStorage('td_admin_teachers', data);
      }
    } catch {
      // Keep local cached teachers
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setName('');
    setDepartment('');
    setSubject('');
    setTagline('');
    setPhotoUrl('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setDepartment(t.department);
    setSubject(t.subject || '');
    setTagline(t.tagline || '');
    setPhotoUrl(t.photo_url || '');
    setIsActive(t.is_active);
    setIsModalOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid File', 'Please select an image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoUrl(result);
        toast.success('Image Loaded', 'Profile photo attached.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim()) {
      toast.error('Validation Error', 'Name and Department are required.');
      return;
    }

    setIsSaving(true);
    const res = await saveTeacher({
      id: editingTeacher?.id,
      name,
      department,
      subject,
      tagline,
      photo_url: photoUrl,
      is_active: isActive,
    });

    setIsSaving(false);
    if (res.success) {
      toast.success(editingTeacher ? 'Teacher Updated' : 'Teacher Added');
      setIsModalOpen(false);
      fetchTeachers();
    } else {
      toast.error('Error', res.error || 'Failed to save teacher.');
    }
  };

  const handleToggleActive = async (teacher: Teacher) => {
    const res = await saveTeacher({
      id: teacher.id,
      name: teacher.name,
      department: teacher.department,
      photo_url: teacher.photo_url,
      is_active: !teacher.is_active,
    });

    if (res.success) {
      toast.success(`Teacher ${!teacher.is_active ? 'Activated' : 'Deactivated'}`);
      fetchTeachers();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteTeacher(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (res.success) {
      toast.success('Teacher Deleted', `${deleteTarget.name} was successfully removed.`);
      fetchTeachers();
    } else {
      toast.error('Error', res.error || 'Failed to delete teacher.');
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <GraduationCap className="text-primary-400" size={24} />
            Teacher Management
          </h1>
          <p className="section-subtitle">
            Add, edit, delete, activate/deactivate candidate teachers for awards ({teachers.length} total)
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenAdd}
        >
          Add Teacher
        </Button>
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Search by name or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Table / Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="p-8 text-center text-surface-400 text-sm">
          No teachers found matching your search.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => (
            <Card key={teacher.id} variant="default" className="relative group">
              <div className="flex items-start gap-3">
                {/* Photo or Initials Avatar */}
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={teacher.name}
                    className="w-12 h-12 rounded-xl object-cover border border-surface-600 flex-shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                    {getInitials(teacher.name)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {teacher.name}
                    </h3>
                    <Badge variant={teacher.is_active ? 'success' : 'neutral'}>
                      {teacher.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <p className="text-xs text-primary-300 font-medium">
                    {teacher.department}
                  </p>
                  {teacher.subject && (
                    <p className="text-[11px] text-surface-400 truncate">
                      Subject: {teacher.subject}
                    </p>
                  )}
                  {teacher.tagline && (
                    <p className="text-[10px] text-surface-500 italic mt-1 truncate">
                      "{teacher.tagline}"
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-surface-700/50 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={teacher.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                  onClick={() => handleToggleActive(teacher)}
                >
                  {teacher.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Edit2 size={14} />}
                  onClick={() => handleOpenEdit(teacher)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} className="text-surface-500 hover:text-rose-400" />}
                  onClick={() => setDeleteTarget(teacher)}
                  aria-label={`Delete ${teacher.name}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload & Preview Section */}
          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">
              Profile Photo (Upload from Device or URL)
            </label>
            <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-900/60 border border-surface-700/60">
              {photoUrl ? (
                <div className="relative group/photo flex-shrink-0">
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-primary-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow hover:bg-rose-600"
                    title="Remove Photo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-800 border-2 border-dashed border-surface-600 flex items-center justify-center text-surface-500 flex-shrink-0">
                  <ImageIcon size={24} />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Upload size={14} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Image
                  </Button>
                </div>
                <Input
                  placeholder="Or paste image URL here..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="!py-1.5 !text-xs"
                />
              </div>
            </div>
          </div>

          <Input
            label="Full Name *"
            placeholder="e.g. Dr. Priya Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Department *"
            placeholder="e.g. Computer Science"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />

          <Input
            label="Subject (Optional)"
            placeholder="e.g. Data Structures"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <Input
            label="Tagline / Motto (Optional)"
            placeholder="e.g. Making learning fun!"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="is_active_check" className="text-sm text-surface-200">
              Active candidate (eligible for voting)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-700/50">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingTeacher ? 'Save Changes' : 'Create Teacher'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${deleteTarget?.name}?`}
        warning="This teacher will be permanently removed from all voting ballots and category assignments."
        confirmText="Delete Teacher"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
