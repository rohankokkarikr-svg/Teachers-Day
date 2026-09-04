import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Plus,
  Edit2,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { getLocalStorage, setLocalStorage } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';
import { INITIAL_CATEGORIES_DATA, getCategoryTeacherAssignments, getDefaultCategoryTeachers } from '../../data/initialCategories';
import { getAllTeachers, resolvePermanentPhoto } from '../../hooks/useTeachers';
import type { Category, Teacher } from '../../types';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>(() =>
    getLocalStorage<Category[]>('td_admin_categories', INITIAL_CATEGORIES_DATA)
  );
  const [teachers, setTeachers] = useState<Teacher[]>(() => getAllTeachers());
  const [categoryAssignments, setCategoryAssignments] = useState<Record<string, string[]>>(() =>
    getCategoryTeacherAssignments()
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [assignCategory, setAssignCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [assignedTeacherIds, setAssignedTeacherIds] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');
  const [assignDeptFilter, setAssignDeptFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { saveCategory, deleteCategory, logAction } = useAdmin();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('✨');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const fetchData = useCallback(async () => {
    const localCats = getLocalStorage<Category[]>('td_admin_categories', INITIAL_CATEGORIES_DATA);
    const localTeachers = getAllTeachers();
    const localAssignments = getCategoryTeacherAssignments();

    setCategories(localCats);
    setTeachers(localTeachers);
    setCategoryAssignments(localAssignments);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const catsPromise = supabase.from('categories').select('*').order('display_order');
      const teacherPromise = supabase.from('teachers').select('*').order('name');
      const ctPromise = supabase.from('category_teachers').select('category_id, teacher_id');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Categories fetch timeout')), 2500)
      );

      const [catRes, teacherRes, ctRes] = (await Promise.race([
        Promise.all([catsPromise, teacherPromise, ctPromise]),
        timeoutPromise,
      ])) as any;

      if (catRes?.data && catRes.data.length > 0) {
        setCategories(catRes.data as Category[]);
        setLocalStorage('td_admin_categories', catRes.data);
      }
      if (teacherRes?.data && teacherRes.data.length > 0) {
        const resolvedTeachers: Teacher[] = teacherRes.data.map((t: Teacher) => ({
          ...t,
          photo_url: resolvePermanentPhoto(t),
        }));
        setTeachers(resolvedTeachers);
        setLocalStorage('td_admin_teachers', resolvedTeachers);
      }

      // Sync category-teacher assignments safely
      const currentAssignments = getCategoryTeacherAssignments();
      const freshAssignments: Record<string, string[]> = { ...currentAssignments };

      // Only populate from Supabase if ctRes has actual data
      if (ctRes?.data && Array.isArray(ctRes.data) && ctRes.data.length > 0) {
        const remoteMap: Record<string, string[]> = {};
        ctRes.data.forEach((ct: { category_id: string; teacher_id: string }) => {
          if (!remoteMap[ct.category_id]) {
            remoteMap[ct.category_id] = [];
          }
          if (!remoteMap[ct.category_id].includes(ct.teacher_id)) {
            remoteMap[ct.category_id].push(ct.teacher_id);
          }
        });

        // Only override categories that have remote records
        Object.entries(remoteMap).forEach(([cId, tIds]) => {
          if (tIds.length > 0) {
            freshAssignments[cId] = tIds;
          }
        });
      }

      // Ensure every active category has valid assigned teachers (fallback to defaults if empty)
      const activeCats = (catRes?.data || localCats) as Category[];
      activeCats.forEach((c) => {
        if (!freshAssignments[c.id] || freshAssignments[c.id].length === 0) {
          freshAssignments[c.id] = getDefaultCategoryTeachers(c);
        }
      });

      setCategoryAssignments(freshAssignments);
      setLocalStorage('td_category_teacher_assignments', freshAssignments);
    } catch {
      // Keep cached data
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      const localAssignments = getCategoryTeacherAssignments();
      setCategoryAssignments(localAssignments);
    };

    window.addEventListener('td_admin_categories_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('td_admin_categories_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchData]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIcon('✨');
    setDisplayOrder(categories.length + 1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setName(c.name);
    setDescription(c.description || '');
    setIcon(c.icon || '🏆');
    setDisplayOrder(c.display_order);
    setIsActive(c.is_active);
    setIsModalOpen(true);
  };

  const handleOpenAssign = async (c: Category) => {
    setAssignCategory(c);
    setAssignSearch('');
    setAssignDeptFilter('ALL');

    const assignments = getCategoryTeacherAssignments();
    const currentAssignedList = assignments[c.id] || getDefaultCategoryTeachers(c);
    setAssignedTeacherIds(new Set(currentAssignedList));
    setIsAssignModalOpen(true);

    if (!isSupabaseConfigured) return;

    try {
      const { data } = await supabase
        .from('category_teachers')
        .select('teacher_id')
        .eq('category_id', c.id);

      if (data && Array.isArray(data) && data.length > 0) {
        const ids = data.map((ct: { teacher_id: string }) => ct.teacher_id);
        setAssignedTeacherIds(new Set(ids));
        setCategoryAssignments((prev) => {
          const updated = { ...prev, [c.id]: ids };
          setLocalStorage('td_category_teacher_assignments', updated);
          return updated;
        });
      }
    } catch {
      // Keep local
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Validation Error', 'Category name is required.');
      return;
    }

    setIsSaving(true);
    const res = await saveCategory({
      id: editingCategory?.id,
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim() || '🏆',
      display_order: displayOrder,
      is_active: isActive,
    });

    setIsSaving(false);
    if (res.success) {
      toast.success(editingCategory ? 'Category Updated' : 'Category Added');
      setIsModalOpen(false);
      fetchData();
    } else {
      toast.error('Error', res.error || 'Failed to save category.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteCategory(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (res.success) {
      toast.success('Category Deleted', `${deleteTarget.name} was successfully removed.`);
      fetchData();
    } else {
      toast.error('Error', res.error || 'Failed to delete category.');
    }
  };

  const updateAssignmentsState = (catId: string, teacherIds: string[]) => {
    const updatedAssignments = {
      ...categoryAssignments,
      [catId]: teacherIds,
    };
    setCategoryAssignments(updatedAssignments);
    setLocalStorage('td_category_teacher_assignments', updatedAssignments);
    window.dispatchEvent(new Event('td_admin_categories_updated'));
    window.dispatchEvent(new Event('td_admin_teachers_updated'));
  };

  const handleToggleAssignTeacher = async (teacherId: string) => {
    if (!assignCategory) return;

    const newSet = new Set(assignedTeacherIds);
    const isAdding = !newSet.has(teacherId);

    if (isAdding) {
      newSet.add(teacherId);
    } else {
      newSet.delete(teacherId);
    }
    setAssignedTeacherIds(newSet);

    const updatedList = Array.from(newSet);
    updateAssignmentsState(assignCategory.id, updatedList);

    if (isSupabaseConfigured) {
      try {
        if (isAdding) {
          await supabase.from('category_teachers').upsert(
            {
              category_id: assignCategory.id,
              teacher_id: teacherId,
            },
            { onConflict: 'category_id,teacher_id' }
          );
        } else {
          await supabase
            .from('category_teachers')
            .delete()
            .eq('category_id', assignCategory.id)
            .eq('teacher_id', teacherId);
        }
      } catch {
        // Handled locally
      }
    }
  };

  const handleSelectAllTeachers = async () => {
    if (!assignCategory) return;
    const allIds = teachers.map((t) => t.id);
    const newSet = new Set(allIds);
    setAssignedTeacherIds(newSet);

    updateAssignmentsState(assignCategory.id, allIds);

    if (isSupabaseConfigured) {
      try {
        const records = allIds.map((tId) => ({ category_id: assignCategory.id, teacher_id: tId }));
        await supabase.from('category_teachers').upsert(records, { onConflict: 'category_id,teacher_id' });
        await logAction('Assigned All Teachers to Category', { category: assignCategory.name, count: allIds.length });
      } catch {
        // Handled locally
      }
    }
  };

  const handleClearAllTeachers = async () => {
    if (!assignCategory) return;
    setAssignedTeacherIds(new Set());

    updateAssignmentsState(assignCategory.id, []);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('category_teachers').delete().eq('category_id', assignCategory.id);
        await logAction('Cleared Nominees for Category', { category: assignCategory.name });
      } catch {
        // Handled locally
      }
    }
  };

  const handleSelectFilteredTeachers = async (filtered: Teacher[]) => {
    if (!assignCategory) return;
    const newSet = new Set(assignedTeacherIds);
    filtered.forEach((t) => newSet.add(t.id));
    setAssignedTeacherIds(newSet);

    const updatedList = Array.from(newSet);
    updateAssignmentsState(assignCategory.id, updatedList);

    if (isSupabaseConfigured) {
      try {
        const records = filtered.map((t) => ({ category_id: assignCategory.id, teacher_id: t.id }));
        await supabase.from('category_teachers').upsert(records, { onConflict: 'category_id,teacher_id' });
        await logAction('Assigned Filtered Teachers to Category', { category: assignCategory.name, count: filtered.length });
      } catch {
        // Handled locally
      }
    }
  };

  // Departments for modal filtering
  const assignDepartments = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set).sort();
  }, [teachers]);

  // Filtered teachers inside the assign modal
  const filteredModalTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchQuery =
        t.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        t.department.toLowerCase().includes(assignSearch.toLowerCase()) ||
        (t.subject && t.subject.toLowerCase().includes(assignSearch.toLowerCase()));

      const matchDept = assignDeptFilter === 'ALL' || t.department === assignDeptFilter;
      return matchQuery && matchDept;
    });
  }, [teachers, assignSearch, assignDeptFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <FolderOpen className="text-gold-400" size={24} />
            Category Management
          </h1>
          <p className="section-subtitle">
            Configure award categories, descriptions, display order, and assign candidate teachers ({categories.length} categories, {teachers.length} total teachers)
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenAdd}
        >
          Add Category
        </Button>
      </div>

      {/* Categories List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => {
            const assignedCount = categoryAssignments[category.id]?.length ?? 0;

            return (
              <Card key={category.id} variant="default" padding="none">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4">
                  {/* Info & Icon */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-2xl mt-0.5 sm:mt-0">
                      {category.icon || '🏆'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {category.name}
                        </h3>
                        <Badge variant={category.is_active ? 'success' : 'neutral'}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {category.description && (
                        <p className="text-xs text-surface-400 line-clamp-2">
                          {category.description}
                        </p>
                      )}
                      <p className="text-[10px] text-surface-500 mt-1 font-mono">
                        Order: #{category.display_order} · Nominees: {assignedCount} teachers
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06] flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Users size={14} />}
                      onClick={() => handleOpenAssign(category)}
                      className="text-xs"
                    >
                      Nominees ({assignedCount})
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Edit2 size={14} />}
                      onClick={() => handleOpenEdit(category)}
                      className="text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={14} className="text-surface-500 hover:text-rose-400" />}
                      onClick={() => setDeleteTarget(category)}
                      aria-label={`Delete ${category.name}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Most Inspiring Teacher"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Description"
            placeholder="e.g. The teacher who lights the spark of curiosity"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Icon / Emoji"
              placeholder="✨"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
            <Input
              label="Display Order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="category_active_check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-surface-800 border-surface-600 text-primary-500"
            />
            <label htmlFor="category_active_check" className="text-sm text-surface-200">
              Active category (visible to students for voting)
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
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Teachers Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Nominees — ${assignCategory?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Top Bar with quick counters and action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="!text-xs">
                {assignedTeacherIds.size} of {teachers.length} Assigned
              </Badge>
              <span className="text-xs text-surface-400">
                ({filteredModalTeachers.length} shown)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllTeachers}
                icon={<CheckCheck size={12} />}
                className="text-xs !py-1 text-primary-400 hover:text-primary-300"
              >
                Select All
              </Button>
              {filteredModalTeachers.length < teachers.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectFilteredTeachers(filteredModalTeachers)}
                  className="text-xs !py-1 text-emerald-400 hover:text-emerald-300"
                >
                  Select Filtered
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllTeachers}
                icon={<RotateCcw size={12} />}
                className="text-xs !py-1 text-rose-400 hover:text-rose-300"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Search and Department Filter Toolbar */}
          <div className="space-y-2">
            <Input
              placeholder="Search teachers by name, department, or subject..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              icon={<Search size={14} />}
              className="!py-1.5 !text-xs"
            />

            {/* Department chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
              <button
                type="button"
                onClick={() => setAssignDeptFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex-shrink-0 text-[11px] font-medium ${
                  assignDeptFilter === 'ALL'
                    ? 'bg-primary-500 text-white font-semibold'
                    : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}
              >
                All ({teachers.length})
              </button>
              {assignDepartments.map((dept) => {
                const count = teachers.filter((t) => t.department === dept).length;
                const isSelected = assignDeptFilter === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setAssignDeptFilter(dept)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex-shrink-0 text-[11px] font-medium ${
                      isSelected
                        ? 'bg-primary-500 text-white font-semibold'
                        : 'bg-surface-800 text-surface-400 hover:text-white'
                    }`}
                  >
                    {dept} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nominees List */}
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-surface-800/40">
            {filteredModalTeachers.length === 0 ? (
              <div className="p-8 text-center text-surface-400 text-xs">
                No teachers match your search or department filter.
              </div>
            ) : (
              filteredModalTeachers.map((teacher) => {
                const isAssigned = assignedTeacherIds.has(teacher.id);
                return (
                  <div
                    key={teacher.id}
                    onClick={() => handleToggleAssignTeacher(teacher.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isAssigned
                        ? 'border-primary-500/40 bg-primary-500/10'
                        : 'border-surface-700/40 bg-surface-800/30 hover:bg-surface-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white truncate">{teacher.name}</p>
                        {!teacher.is_active && (
                          <span className="text-[10px] text-surface-500">(Inactive)</span>
                        )}
                      </div>
                      <p className="text-[11px] text-primary-300 truncate">
                        {teacher.department}
                        {teacher.subject && ` · ${teacher.subject}`}
                      </p>
                    </div>

                    {isAssigned ? (
                      <Badge variant="success" icon={<CheckCircle2 size={12} />} className="!text-[10px] !py-0.5">
                        Assigned
                      </Badge>
                    ) : (
                      <Badge variant="neutral" icon={<XCircle size={12} />} className="!text-[10px] !py-0.5">
                        Excluded
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-surface-700/50">
            <span className="text-xs text-surface-400 font-medium">
              Changes save automatically
            </span>
            <Button variant="primary" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Category Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete ${deleteTarget?.name}?`}
        warning="This category will be permanently removed from all student voting ballots and results."
        confirmText="Delete Category"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
