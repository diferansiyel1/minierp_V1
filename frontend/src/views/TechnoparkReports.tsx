import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type TechnoparkLineCategory =
  | 'RD_INCOME'
  | 'RD_INCOME_CHANGE'
  | 'RD_EXPENSE'
  | 'RD_EXPENSE_CHANGE'
  | 'NON_RD_EXPENSE'
  | 'NON_RD_EXPENSE_CHANGE'
  | 'NON_RD_INCOME'
  | 'NON_RD_INCOME_CHANGE'
  | 'FSMH'
  | 'FSMH_CHANGE'
  | 'TAX_EXEMPTION'
  | 'TAX_EXEMPTION_CHANGE';

interface TechnoparkProjectEntry {
  project_id?: number | null;
  project_name: string;
  stb_project_code?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
  end_date?: string | null;
  rd_personnel_count: number;
  support_personnel_count: number;
  non_scope_personnel_count: number;
  design_personnel_count: number;
  total_personnel_count: number;
}

interface TechnoparkProjectProgress {
  project_id?: number | null;
  project_name: string;
  stb_project_code?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
  progress_text?: string | null;
  rd_personnel_count: number;
  support_personnel_count: number;
  non_scope_personnel_count: number;
  design_personnel_count: number;
  total_personnel_count: number;
}

interface TechnoparkPersonnelEntry {
  employee_id?: number | null;
  tc_id_no?: string | null;
  full_name: string;
  personnel_type?: string | null;
  is_it_personnel: boolean;
  tgb_inside_minutes: number;
  tgb_outside_minutes: number;
  annual_leave_minutes: number;
  official_holiday_minutes: number;
  cb_outside_minutes: number;
  total_minutes: number;
}

interface TechnoparkLineItem {
  category: TechnoparkLineCategory;
  project_id?: number | null;
  project_name?: string | null;
  item_type?: string | null;
  title?: string | null;
  amount: number;
  period_label?: string | null;
  changed_at?: string | null;
  notes?: string | null;
}

interface TechnoparkReport {
  id: number;
  year: number;
  month: number;
  period_label?: string | null;
  company_name?: string | null;
  tax_office?: string | null;
  tax_id?: string | null;
  sgk_workplace_no?: string | null;
  project_entries: TechnoparkProjectEntry[];
  project_progress_entries: TechnoparkProjectProgress[];
  personnel_entries: TechnoparkPersonnelEntry[];
  line_items: TechnoparkLineItem[];
}

const hoursToMinutes = (hours: number) => Math.round((hours || 0) * 60);
const minutesToHours = (minutes: number) => (minutes || 0) / 60;

const emptyProjectEntry = (): TechnoparkProjectEntry => ({
  project_name: '',
  stb_project_code: '',
  start_date: '',
  planned_end_date: '',
  end_date: '',
  rd_personnel_count: 0,
  support_personnel_count: 0,
  non_scope_personnel_count: 0,
  design_personnel_count: 0,
  total_personnel_count: 0,
});

const emptyProgressEntry = (): TechnoparkProjectProgress => ({
  project_name: '',
  stb_project_code: '',
  start_date: '',
  planned_end_date: '',
  progress_text: '',
  rd_personnel_count: 0,
  support_personnel_count: 0,
  non_scope_personnel_count: 0,
  design_personnel_count: 0,
  total_personnel_count: 0,
});

const emptyPersonnelEntry = (): TechnoparkPersonnelEntry => ({
  full_name: '',
  tc_id_no: '',
  personnel_type: '',
  is_it_personnel: false,
  tgb_inside_minutes: 0,
  tgb_outside_minutes: 0,
  annual_leave_minutes: 0,
  official_holiday_minutes: 0,
  cb_outside_minutes: 0,
  total_minutes: 0,
});

const emptyLineItem = (category: TechnoparkLineCategory): TechnoparkLineItem => ({
  category,
  project_name: '',
  item_type: '',
  title: '',
  amount: 0,
  period_label: '',
  changed_at: '',
  notes: '',
});

const baseLineItemCategories: TechnoparkLineCategory[] = [
  'NON_RD_INCOME',
  'NON_RD_INCOME_CHANGE',
  'RD_EXPENSE',
  'RD_EXPENSE_CHANGE',
  'NON_RD_EXPENSE',
  'NON_RD_EXPENSE_CHANGE',
  'FSMH',
  'FSMH_CHANGE',
  'TAX_EXEMPTION',
  'TAX_EXEMPTION_CHANGE',
];

const buildEmptyLineItems = () => baseLineItemCategories.map((category) => emptyLineItem(category));

const normalizeDate = (value?: string | null) => (value ? value.split('T')[0] : '');

const normalizeReport = (report: TechnoparkReport): TechnoparkReport => ({
  ...report,
  project_entries: (report.project_entries || []).map((entry) => ({
    ...entry,
    start_date: normalizeDate(entry.start_date || undefined),
    planned_end_date: normalizeDate(entry.planned_end_date || undefined),
    end_date: normalizeDate(entry.end_date || undefined),
  })),
  project_progress_entries: (report.project_progress_entries || []).map((entry) => ({
    ...entry,
    start_date: normalizeDate(entry.start_date || undefined),
    planned_end_date: normalizeDate(entry.planned_end_date || undefined),
  })),
  line_items: (report.line_items || []).map((item) => ({
    ...item,
    changed_at: normalizeDate(item.changed_at || undefined),
  })),
});

const TechnoparkReports = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: reports = [], isFetching } = useQuery<TechnoparkReport[]>({
    queryKey: ['technopark-reports', year, month],
    queryFn: async () => {
      const response = await api.get('/technopark-reports', { params: { year, month } });
      return response.data;
    },
  });

  const activeReport = useMemo(() => reports[0], [reports]);

  const [periodLabel, setPeriodLabel] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxId, setTaxId] = useState('');
  const [sgkWorkplaceNo, setSgkWorkplaceNo] = useState('');
  const [projectEntries, setProjectEntries] = useState<TechnoparkProjectEntry[]>([]);
  const [projectProgressEntries, setProjectProgressEntries] = useState<TechnoparkProjectProgress[]>([]);
  const [personnelEntries, setPersonnelEntries] = useState<TechnoparkPersonnelEntry[]>([]);
  const [lineItems, setLineItems] = useState<TechnoparkLineItem[]>([]);

  useEffect(() => {
    if (!activeReport) {
      setPeriodLabel('');
      setCompanyName('');
      setTaxOffice('');
      setTaxId('');
      setSgkWorkplaceNo('');
      setProjectEntries([]);
      setProjectProgressEntries([]);
      setPersonnelEntries([]);
      setLineItems([]);
      return;
    }

    const normalized = normalizeReport(activeReport);
    setPeriodLabel(normalized.period_label || '');
    setCompanyName(normalized.company_name || '');
    setTaxOffice(normalized.tax_office || '');
    setTaxId(normalized.tax_id || '');
    setSgkWorkplaceNo(normalized.sgk_workplace_no || '');
    setProjectEntries(normalized.project_entries || []);
    setProjectProgressEntries(normalized.project_progress_entries || []);
    setPersonnelEntries(normalized.personnel_entries || []);
    setLineItems(normalized.line_items || []);
  }, [activeReport]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        year,
        month,
        period_label: periodLabel,
        company_name: companyName,
        tax_office: taxOffice,
        tax_id: taxId,
        sgk_workplace_no: sgkWorkplaceNo,
        project_entries: projectEntries,
        project_progress_entries: projectProgressEntries,
        personnel_entries: personnelEntries,
        line_items: lineItems,
      };
      const response = await api.post('/technopark-reports/upsert', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technopark-reports'] });
      toast.success('Teknokent raporu kaydedildi');
    },
    onError: (error: any) => {
      toast.error('Kayıt başarısız: ' + (error.response?.data?.detail || error.message));
    },
  });

  const autofillMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/technopark-reports/auto-fill', {
        params: { year, month },
      });
      return response.data as TechnoparkReport;
    },
    onSuccess: (data) => {
      const normalized = normalizeReport(data);
      setPeriodLabel(normalized.period_label || '');
      setCompanyName(normalized.company_name || '');
      setTaxOffice(normalized.tax_office || '');
      setTaxId(normalized.tax_id || '');
      setSgkWorkplaceNo(normalized.sgk_workplace_no || '');
      setProjectEntries(normalized.project_entries || []);
      setProjectProgressEntries(normalized.project_progress_entries || []);
      setPersonnelEntries(normalized.personnel_entries || []);
      setLineItems(normalized.line_items || []);
      toast.success('Otomatik hesaplama tamamlandı');
    },
    onError: (error: any) => {
      toast.error('Otomatik doldurma başarısız: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleResetForm = () => {
    const confirmed = window.confirm('Ekrandaki veriler sıfırlanacak. Devam etmek istiyor musunuz?');
    if (!confirmed) return;
    setPeriodLabel('');
    setCompanyName('');
    setTaxOffice('');
    setTaxId('');
    setSgkWorkplaceNo('');
    setProjectEntries([]);
    setProjectProgressEntries([]);
    setPersonnelEntries([]);
    setLineItems(buildEmptyLineItems());
  };

  const downloadReport = async () => {
    if (!activeReport) {
      toast.error('Önce raporu kaydedin');
      return;
    }
    const response = await api.get(`/technopark-reports/${activeReport.id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Teknokent_Muafiyet_Raporu_${year}_${month}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  };

  const updateLineItem = (index: number, updates: Partial<TechnoparkLineItem>) => {
    setLineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const lineItemsByCategory = useCallback(
    (category: TechnoparkLineCategory) => lineItems.filter((item) => item.category === category),
    [lineItems]
  );

  const ensureLineItems = useCallback(
    (category: TechnoparkLineCategory) => {
      if (!lineItemsByCategory(category).length) {
        setLineItems((prev) => [...prev, emptyLineItem(category)]);
      }
    },
    [lineItemsByCategory]
  );

  useEffect(() => {
    ensureLineItems('NON_RD_INCOME');
    ensureLineItems('NON_RD_INCOME_CHANGE');
    ensureLineItems('RD_EXPENSE');
    ensureLineItems('RD_EXPENSE_CHANGE');
    ensureLineItems('NON_RD_EXPENSE');
    ensureLineItems('NON_RD_EXPENSE_CHANGE');
    ensureLineItems('FSMH');
    ensureLineItems('FSMH_CHANGE');
    ensureLineItems('TAX_EXEMPTION');
    ensureLineItems('TAX_EXEMPTION_CHANGE');
  }, [ensureLineItems]);

  const renderLineItemSection = (
    title: string,
    category: TechnoparkLineCategory,
    options: { project?: boolean; title?: boolean; period?: boolean }
  ) => (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {lineItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category === category)
        .map(({ item, index }) => (
          <div key={`${category}-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-2">
            {options.project && (
              <Input
                placeholder="Proje"
                value={item.project_name || ''}
                onChange={(e) => updateLineItem(index, { project_name: e.target.value })}
              />
            )}
            <Input
              placeholder="Tür"
              value={item.item_type || ''}
              onChange={(e) => updateLineItem(index, { item_type: e.target.value })}
            />
            {options.title && (
              <Input
                placeholder="Buluş Adı"
                value={item.title || ''}
                onChange={(e) => updateLineItem(index, { title: e.target.value })}
              />
            )}
            <Input
              type="number"
              placeholder="Tutar (TL)"
              value={item.amount ?? 0}
              onChange={(e) => updateLineItem(index, { amount: parseFloat(e.target.value) || 0 })}
            />
            {options.period && (
              <>
                <Input
                  placeholder="Ay-Yıl"
                  value={item.period_label || ''}
                  onChange={(e) => updateLineItem(index, { period_label: e.target.value })}
                />
                <Input
                  type="date"
                  value={item.changed_at || ''}
                  onChange={(e) => updateLineItem(index, { changed_at: e.target.value })}
                />
              </>
            )}
          </div>
        ))}
      <Button
        variant="outline"
        onClick={() => setLineItems((prev) => [...prev, emptyLineItem(category)])}
      >
        Satır Ekle
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teknokent Resmi Muafiyet Raporu</CardTitle>
          <CardDescription>Resmi forma uygun veri girişi ve PDF çıktısı</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Yıl</Label>
              <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} />
            </div>
            <div>
              <Label>Ay</Label>
              <Input type="number" value={month} onChange={(e) => setMonth(parseInt(e.target.value) || month)} />
            </div>
            <div>
              <Label>Dönem Etiketi</Label>
              <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Kasım - 2025" />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending || isFetching}>
                Kaydet
              </Button>
              <Button
                variant="secondary"
                onClick={() => autofillMutation.mutate()}
                disabled={autofillMutation.isPending || isFetching}
              >
                Yeniden Otomatik Hesapla
              </Button>
              <Button variant="outline" onClick={handleResetForm}>
                Raporu Sıfırla
              </Button>
              <Button variant="outline" onClick={downloadReport} disabled={!activeReport}>
                PDF İndir
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Firma Unvanı</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <Label>Vergi Dairesi</Label>
              <Input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} />
            </div>
            <div>
              <Label>Vergi No</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div>
              <Label>SGK İşyeri No</Label>
              <Input value={sgkWorkplaceNo} onChange={(e) => setSgkWorkplaceNo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projeler</TabsTrigger>
          <TabsTrigger value="progress">Proje İlerleme</TabsTrigger>
          <TabsTrigger value="personnel">Personel</TabsTrigger>
          <TabsTrigger value="financials">Gelir/Gider</TabsTrigger>
          <TabsTrigger value="fsmh">FSMH/Muafiyet</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Devam Eden Projeler Listesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectEntries.map((entry, index) => (
                <div key={`project-${index}`} className="grid grid-cols-1 md:grid-cols-9 gap-2">
                  <Input
                    placeholder="Proje Adı"
                    value={entry.project_name}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, project_name: e.target.value };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    placeholder="STB Kodu"
                    value={entry.stb_project_code || ''}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, stb_project_code: e.target.value };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="date"
                    value={entry.start_date || ''}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, start_date: e.target.value };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="date"
                    value={entry.planned_end_date || ''}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, planned_end_date: e.target.value };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="date"
                    value={entry.end_date || ''}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, end_date: e.target.value };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Ar-Ge"
                    value={entry.rd_personnel_count}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, rd_personnel_count: parseInt(e.target.value) || 0 };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Destek"
                    value={entry.support_personnel_count}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, support_personnel_count: parseInt(e.target.value) || 0 };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Kapsam Dışı"
                    value={entry.non_scope_personnel_count}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, non_scope_personnel_count: parseInt(e.target.value) || 0 };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Tasarım"
                    value={entry.design_personnel_count}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, design_personnel_count: parseInt(e.target.value) || 0 };
                      setProjectEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Toplam"
                    value={entry.total_personnel_count}
                    onChange={(e) => {
                      const updated = [...projectEntries];
                      updated[index] = { ...entry, total_personnel_count: parseInt(e.target.value) || 0 };
                      setProjectEntries(updated);
                    }}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={() => setProjectEntries([...projectEntries, emptyProjectEntry()])}>
                Proje Ekle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Proje İlerleme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectProgressEntries.map((entry, index) => (
                <div key={`progress-${index}`} className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <Input
                      placeholder="Proje Adı"
                      value={entry.project_name}
                      onChange={(e) => {
                        const updated = [...projectProgressEntries];
                        updated[index] = { ...entry, project_name: e.target.value };
                        setProjectProgressEntries(updated);
                      }}
                    />
                    <Input
                      placeholder="STB Kodu"
                      value={entry.stb_project_code || ''}
                      onChange={(e) => {
                        const updated = [...projectProgressEntries];
                        updated[index] = { ...entry, stb_project_code: e.target.value };
                        setProjectProgressEntries(updated);
                      }}
                    />
                    <Input
                      type="date"
                      value={entry.start_date || ''}
                      onChange={(e) => {
                        const updated = [...projectProgressEntries];
                        updated[index] = { ...entry, start_date: e.target.value };
                        setProjectProgressEntries(updated);
                      }}
                    />
                    <Input
                      type="date"
                      value={entry.planned_end_date || ''}
                      onChange={(e) => {
                        const updated = [...projectProgressEntries];
                        updated[index] = { ...entry, planned_end_date: e.target.value };
                        setProjectProgressEntries(updated);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Toplam Personel"
                      value={entry.total_personnel_count}
                      onChange={(e) => {
                        const updated = [...projectProgressEntries];
                        updated[index] = { ...entry, total_personnel_count: parseInt(e.target.value) || 0 };
                        setProjectProgressEntries(updated);
                      }}
                    />
                  </div>
                  <Input
                    placeholder="Proje Planı İlerleme"
                    value={entry.progress_text || ''}
                    onChange={(e) => {
                      const updated = [...projectProgressEntries];
                      updated[index] = { ...entry, progress_text: e.target.value };
                      setProjectProgressEntries(updated);
                    }}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={() => setProjectProgressEntries([...projectProgressEntries, emptyProgressEntry()])}>
                İlerleme Ekle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel">
          <Card>
            <CardHeader>
              <CardTitle>Personel Bilgi Formu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {personnelEntries.map((entry, index) => (
                <div key={`personnel-${index}`} className="grid grid-cols-1 md:grid-cols-9 gap-2">
                  <Input
                    placeholder="Ad Soyad"
                    value={entry.full_name}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, full_name: e.target.value };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    placeholder="TC Kimlik No"
                    value={entry.tc_id_no || ''}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, tc_id_no: e.target.value };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    placeholder="Personel Tipi"
                    value={entry.personnel_type || ''}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, personnel_type: e.target.value };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={entry.is_it_personnel}
                      onChange={(e) => {
                        const updated = [...personnelEntries];
                        updated[index] = { ...entry, is_it_personnel: e.target.checked };
                        setPersonnelEntries(updated);
                      }}
                    />
                    Bilişim
                  </label>
                  <Input
                    type="number"
                    placeholder="TGB İçi (saat)"
                    value={minutesToHours(entry.tgb_inside_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, tgb_inside_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="TGB Dışı (saat)"
                    value={minutesToHours(entry.tgb_outside_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, tgb_outside_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Yıllık İzin (saat)"
                    value={minutesToHours(entry.annual_leave_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, annual_leave_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Resmi Tatil (saat)"
                    value={minutesToHours(entry.official_holiday_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, official_holiday_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="CB Bölge Dışı (saat)"
                    value={minutesToHours(entry.cb_outside_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, cb_outside_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Toplam (saat)"
                    value={minutesToHours(entry.total_minutes)}
                    onChange={(e) => {
                      const updated = [...personnelEntries];
                      updated[index] = { ...entry, total_minutes: hoursToMinutes(parseFloat(e.target.value) || 0) };
                      setPersonnelEntries(updated);
                    }}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={() => setPersonnelEntries([...personnelEntries, emptyPersonnelEntry()])}>
                Personel Ekle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle>Gelir & Gider Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderLineItemSection('Firma Ar-Ge Dışı Satış Geliri Bilgileri', 'NON_RD_INCOME', { project: false, title: false, period: false })}
              {renderLineItemSection('Firma Ar-Ge Dışı Satış Geliri - Veri Takip Listesi', 'NON_RD_INCOME_CHANGE', { project: false, title: false, period: true })}
              {renderLineItemSection('Firma Ar-Ge Gider Bilgileri', 'RD_EXPENSE', { project: true, title: false, period: false })}
              {renderLineItemSection('Firma Ar-Ge Gider - Veri Takip Listesi', 'RD_EXPENSE_CHANGE', { project: true, title: false, period: true })}
              {renderLineItemSection('Firma Ar-Ge Dışı Gider Bilgileri', 'NON_RD_EXPENSE', { project: false, title: false, period: false })}
              {renderLineItemSection('Firma Ar-Ge Dışı Gider - Veri Takip Listesi', 'NON_RD_EXPENSE_CHANGE', { project: false, title: false, period: true })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fsmh">
          <Card>
            <CardHeader>
              <CardTitle>FSMH ve Muafiyet Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderLineItemSection('Firma FSMH Bilgileri', 'FSMH', { project: false, title: true, period: false })}
              {renderLineItemSection('Firma FSMH - Veri Takip Listesi', 'FSMH_CHANGE', { project: false, title: true, period: true })}
              {renderLineItemSection('Firma Muafiyet Bilgileri', 'TAX_EXEMPTION', { project: false, title: false, period: false })}
              {renderLineItemSection('Firma Muafiyet - Veri Takip Listesi', 'TAX_EXEMPTION_CHANGE', { project: false, title: false, period: true })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TechnoparkReports;
