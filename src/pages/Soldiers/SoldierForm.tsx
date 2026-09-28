import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import {
  fetchCompanies,
  fetchPlatoons,
  createCompany,
  createPlatoon,
  fetchSoldier,
  createSoldier,
  updateSoldier,
} from '../../lib/soldiers';
import { COMMON_RANKS, type Company, type Platoon, type SoldierStatus } from '../../types/database.types';

const statusOptions: { value: SoldierStatus; label: string }[] = [
  { value: 'active', label: 'সক্রিয়' },
  { value: 'transferred', label: 'বদলিকৃত' },
  { value: 'discharged', label: 'অব্যাহতিপ্রাপ্ত' },
];

export function SoldierFormPage() {
  const { id } = useParams(); // undefined হলে "নতুন সৈনিক"
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [platoons, setPlatoons] = useState<Platoon[]>([]);

  const [serviceId, setServiceId] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [platoonId, setPlatoonId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<SoldierStatus>('active');

  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPlatoonName, setNewPlatoonName] = useState('');
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showNewPlatoon, setShowNewPlatoon] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const companyList = await fetchCompanies();
        setCompanies(companyList);
        if (isEdit && id) {
          const soldier = await fetchSoldier(id);
          if (soldier) {
            setServiceId(soldier.service_id);
            setName(soldier.name);
            setRank(soldier.rank);
            setCompanyId(soldier.company_id ?? '');
            setPlatoonId(soldier.platoon_id ?? '');
            setMobileNumber(soldier.mobile_number ?? '');
            setRemarks(soldier.remarks ?? '');
            setStatus(soldier.status);
            if (soldier.company_id) {
              setPlatoons(await fetchPlatoons(soldier.company_id));
            }
          }
        }
      } catch {
        setError('তথ্য লোড করা যায়নি।');
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCompanyChange(value: string) {
    setCompanyId(value);
    setPlatoonId('');
    if (value) {
      setPlatoons(await fetchPlatoons(value));
    } else {
      setPlatoons([]);
    }
  }

  async function handleAddCompany() {
    if (!newCompanyName.trim()) return;
    const created = await createCompany(newCompanyName.trim());
    setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyId(created.id);
    setNewCompanyName('');
    setShowNewCompany(false);
    setPlatoons([]);
  }

  async function handleAddPlatoon() {
    if (!newPlatoonName.trim() || !companyId) return;
    const created = await createPlatoon(companyId, newPlatoonName.trim());
    setPlatoons((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setPlatoonId(created.id);
    setNewPlatoonName('');
    setShowNewPlatoon(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = {
        service_id: serviceId.trim(),
        name: name.trim(),
        rank: rank.trim(),
        company_id: companyId || null,
        platoon_id: platoonId || null,
        mobile_number: mobileNumber.trim() || null,
        remarks: remarks.trim() || null,
        status,
      };
      const saved = isEdit && id ? await updateSoldier(id, input) : await createSoldier(input);
      navigate(`/soldiers/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('duplicate') || message.includes('unique')) {
        setError('এই সার্ভিস-নম্বর ইতিমধ্যে ব্যবহৃত হয়েছে — অনুগ্রহ করে যাচাই করুন।');
      } else {
        setError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-5 text-lg font-semibold text-ink">
        {isEdit ? 'সৈনিক-তথ্য সম্পাদনা' : 'নতুন সৈনিক যোগ করুন'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg rounded-[var(--radius-card)] border border-steel/20 bg-white p-5"
      >
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">সার্ভিস নম্বর *</label>
          <input
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">পদবি *</label>
          <input
            required
            list="rank-suggestions"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            placeholder="যেমন: সৈনিক, কর্পোরাল, সার্জেন্ট"
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
          />
          <datalist id="rank-suggestions">
            {COMMON_RANKS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">নাম *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">কোম্পানি</label>
          {!showNewCompany ? (
            <div className="flex gap-2">
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              >
                <option value="">— নির্বাচন করুন —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCompany(true)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink hover:bg-steel/10"
              >
                + নতুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="নতুন কোম্পানির নাম"
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="whitespace-nowrap rounded-[var(--radius-control)] bg-navy px-3 py-2 text-sm text-white"
              >
                যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowNewCompany(false)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink"
              >
                বাতিল
              </button>
            </div>
          )}
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-ink">প্লাটুন</label>
          {!showNewPlatoon ? (
            <div className="flex gap-2">
              <select
                value={platoonId}
                onChange={(e) => setPlatoonId(e.target.value)}
                disabled={!companyId}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy disabled:bg-steel/5"
              >
                <option value="">— নির্বাচন করুন —</option>
                {platoons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewPlatoon(true)}
                disabled={!companyId}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink hover:bg-steel/10 disabled:opacity-50"
              >
                + নতুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={newPlatoonName}
                onChange={(e) => setNewPlatoonName(e.target.value)}
                placeholder="নতুন প্লাটুনের নাম"
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              />
              <button
                type="button"
                onClick={handleAddPlatoon}
                className="whitespace-nowrap rounded-[var(--radius-control)] bg-navy px-3 py-2 text-sm text-white"
              >
                যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowNewPlatoon(false)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink"
              >
                বাতিল
              </button>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">মোবাইল নাম্বার</label>
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="যেমন: ০১৭xxxxxxxx"
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-ink">মন্তব্য</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-ink">স্ট্যাটাস</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SoldierStatus)}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 font-medium text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-60"
          >
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2.5 font-medium text-ink"
          >
            বাতিল
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
