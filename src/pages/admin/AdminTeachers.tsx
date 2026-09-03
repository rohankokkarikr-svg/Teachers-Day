import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  Trash2,
  Upload,
  Image as ImageIcon,
  X,
  FileSpreadsheet,
  Download,
  Users,
  Building,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { getInitials, getLocalStorage, setLocalStorage, exportToCSV } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';
import { INITIAL_TEACHERS_DATA } from '../../data/initialTeachers';
import type { Teacher } from '../../types';

const PAGE_SIZE = 18;

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>(() =>
    getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_TEACHERS_DATA)
  );
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'dept' | 'status'>('name_asc');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<Partial<Teacher> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkCsvInputRef = useRef<HTMLInputElement>(null);

  const { saveTeacher, deleteTeacher } = useAdmin();

  // Single Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [tagline, setTagline] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchTeachers = useCallback(async () => {
    const local = getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_TEACHERS_DATA);
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

  // Derived departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set).sort();
  }, [teachers]);

  // Filtered and sorted teachers
  const filteredTeachers = useMemo(() => {
    let result = teachers.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.department.toLowerCase().includes(search.toLowerCase()) ||
        (t.subject && t.subject.toLowerCase().includes(search.toLowerCase())) ||
        (t.tagline && t.tagline.toLowerCase().includes(search.toLowerCase()));

      const matchesDept = selectedDept === 'ALL' || t.department === selectedDept;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && t.is_active) ||
        (statusFilter === 'inactive' && !t.is_active);

      return matchesSearch && matchesDept && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'dept') return a.department.localeCompare(b.department) || a.name.localeCompare(b.name);
      if (sortBy === 'status') return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
      return 0;
    });

    return result;
  }, [teachers, search, selectedDept, statusFilter, sortBy]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));
  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTeachers.slice(start, start + PAGE_SIZE);
  }, [filteredTeachers, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDept, statusFilter, sortBy]);

  const activeCount = useMemo(() => teachers.filter((t) => t.is_active).length, [teachers]);
  const inactiveCount = teachers.length - activeCount;

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
      name: name.trim(),
      department: department.trim(),
      subject: subject.trim(),
      tagline: tagline.trim(),
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
      subject: teacher.subject,
      tagline: teacher.tagline,
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

  // Bulk Import CSV / Text Handler
  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Empty Data', 'Please enter teacher records or upload a CSV file.');
      return;
    }

    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error('No Records Found', 'Please check the formatting and try again.');
      return;
    }

    setIsBulkSaving(true);
    let addedCount = 0;

    for (const line of lines) {
      // Format: Name, Department, Subject (optional), Tagline (optional)
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const tName = parts[0];
        const tDept = parts[1];
        const tSubject = parts[2] || '';
        const tTagline = parts[3] || '';

        if (tName && tDept) {
          await saveTeacher({
            name: tName,
            department: tDept,
            subject: tSubject,
            tagline: tTagline,
            is_active: true,
          });
          addedCount++;
        }
      }
    }

    setIsBulkSaving(false);
    setIsBulkModalOpen(false);
    setBulkText('');

    if (addedCount > 0) {
      toast.success('Bulk Import Complete', `Successfully added ${addedCount} candidate teachers.`);
      fetchTeachers();
    } else {
      toast.warning('No Valid Rows', 'Ensure rows follow: "Name, Department, Subject, Tagline"');
    }
  };

  const handleBulkCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Strip header line if present
        const rawLines = text.split('\n');
        const firstLine = rawLines[0]?.toLowerCase();
        let content = text;
        if (firstLine && (firstLine.includes('name') || firstLine.includes('department'))) {
          content = rawLines.slice(1).join('\n');
        }
        setBulkText(content);
        toast.success('CSV Loaded', `Loaded content from ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportTeachersCSV = () => {
    const rows = teachers.map((t) => ({
      ID: t.id,
      Name: t.name,
      Department: t.department,
      Subject: t.subject || '',
      Tagline: t.tagline || '',
      Status: t.is_active ? 'Active' : 'Inactive',
    }));

    exportToCSV(rows, `teachers_directory_${new Date().toISOString().slice(0, 10)}`);
    toast.success('Directory Exported', 'Teacher directory CSV file downloaded.');
  };

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
            Manage candidate teachers, assign to awards, and monitor nominees ({teachers.length} total across{' '}
            {departments.length} departments)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportTeachersCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet size={14} />}
            onClick={() => {
              setBulkText('');
              setIsBulkModalOpen(true);
            }}
          >
            Bulk Add
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleOpenAdd}
          >
            Add Teacher
          </Button>
        </div>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center flex-shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Total Teachers</p>
            <p className="text-xl font-bold text-white">{teachers.length}</p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Active Candidates</p>
            <p className="text-xl font-bold text-emerald-400">{activeCount}</p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-700/40 text-surface-400 flex items-center justify-center flex-shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Inactive</p>
            <p className="text-xl font-bold text-surface-300">{inactiveCount}</p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/15 text-gold-400 flex items-center justify-center flex-shrink-0">
            <Building size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Departments</p>
            <p className="text-xl font-bold text-gold-400">{departments.length}</p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by name, department, subject, tagline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>

          {/* Controls: Status + Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center bg-surface-900 border border-surface-700/60 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  statusFilter === 'all'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                All ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  statusFilter === 'active'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  statusFilter === 'inactive'
                    ? 'bg-surface-700 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Inactive ({inactiveCount})
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-surface-900 border border-surface-700/60 rounded-xl px-3 py-2 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
            >
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="dept">Sort: Department</option>
              <option value="status">Sort: Active First</option>
            </select>
          </div>
        </div>

        {/* Department Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
          <button
            type="button"
            onClick={() => setSelectedDept('ALL')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex-shrink-0 font-medium ${
              selectedDept === 'ALL'
                ? 'bg-primary-500/25 border border-primary-500/60 text-white font-semibold shadow-sm'
                : 'bg-surface-900/80 border border-surface-700/50 text-surface-400 hover:text-white'
            }`}
          >
            All Departments ({teachers.length})
          </button>
          {departments.map((dept) => {
            const count = teachers.filter((t) => t.department === dept).length;
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex-shrink-0 font-medium ${
                  isSelected
                    ? 'bg-primary-500/25 border border-primary-500/60 text-white font-semibold shadow-sm'
                    : 'bg-surface-900/80 border border-surface-700/50 text-surface-400 hover:text-white'
                }`}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Teachers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="p-12 text-center text-surface-400 space-y-3">
          <p className="text-base font-semibold text-white">No teachers found</p>
          <p className="text-xs max-w-sm mx-auto">
            No candidate teachers match your search query or department filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedDept('ALL');
              setStatusFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTeachers.map((teacher) => (
              <Card key={teacher.id} variant="default" className="relative group flex flex-col justify-between">
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
                      <h3 className="text-sm font-semibold text-white truncate" title={teacher.name}>
                        {teacher.name}
                      </h3>
                      <Badge variant={teacher.is_active ? 'success' : 'neutral'}>
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <p className="text-xs text-primary-300 font-medium truncate">
                      {teacher.department}
                    </p>
                    {teacher.subject && (
                      <p className="text-[11px] text-surface-400 truncate mt-0.5">
                        {teacher.subject}
                      </p>
                    )}
                    {teacher.tagline && (
                      <p className="text-[10px] text-surface-500 italic mt-1 truncate" title={teacher.tagline}>
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
                    className="text-xs"
                  >
                    {teacher.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 size={14} />}
                    onClick={() => handleOpenEdit(teacher)}
                    className="text-xs"
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

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-surface-700/50 text-xs text-surface-400">
              <div>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredTeachers.length)} of {filteredTeachers.length} teachers
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronLeft size={14} />}
                >
                  Prev
                </Button>

                <span className="px-2 font-medium text-white">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  iconRight={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload & Preview */}
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

          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
              Department *
            </label>
            <div className="space-y-2">
              <Input
                placeholder="e.g. Computer Science, Mathematics, Physics..."
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
              {departments.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[11px] text-surface-400">
                  <span>Quick Select:</span>
                  {departments.slice(0, 5).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDepartment(d)}
                      className="px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-colors"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Input
            label="Subject / Specialization (Optional)"
            placeholder="e.g. Data Structures & Algorithms"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <Input
            label="Tagline / Teaching Motto (Optional)"
            placeholder="e.g. Making algorithms intuitive and fun!"
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
            <label htmlFor="is_active_check" className="text-sm text-surface-200 cursor-pointer">
              Active candidate (eligible for voting ballots)
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

      {/* Bulk Add / Quick Import Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => !isBulkSaving && setIsBulkModalOpen(false)}
        title="Bulk Import Multiple Teachers"
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/30 text-xs text-primary-300 space-y-1">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-gold-400" />
              Quick Batch Adding Format
            </p>
            <p>
              Paste multiple teacher rows below (1 teacher per line), formatted as comma-separated values:
            </p>
            <p className="font-mono bg-surface-900/80 p-2 rounded text-[11px] text-surface-300">
              Dr. Priya Sharma, Computer Science, Data Structures, Making algorithms fun!
              <br />
              Prof. Rajesh Kumar, Mathematics, Calculus, Numbers tell stories
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                Paste CSV Lines or Upload File:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={bulkCsvInputRef}
                  onChange={handleBulkCsvFile}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Upload size={12} />}
                  onClick={() => bulkCsvInputRef.current?.click()}
                  className="text-xs !py-1"
                >
                  Upload .CSV File
                </Button>
              </div>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Name, Department, Subject (optional), Tagline (optional)&#10;Dr. Alan Turing, Computer Science, Cryptography, Breaking complex codes&#10;Dr. Marie Curie, Physics, Radiation, Radiating curiosity"
              className="w-full rounded-xl bg-surface-900 border border-surface-700/60 p-3 text-xs text-white font-mono focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-surface-700/50">
            <span className="text-xs text-surface-400">
              {bulkText.split('\n').filter((l) => l.trim().length > 0).length} row(s) detected
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isBulkSaving}
                onClick={() => setIsBulkModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isBulkSaving}
                onClick={handleBulkImport}
                icon={<Plus size={14} />}
              >
                Import All Teachers
              </Button>
            </div>
          </div>
        </div>
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
