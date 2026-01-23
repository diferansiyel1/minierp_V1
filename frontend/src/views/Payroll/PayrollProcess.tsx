import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  payrollService,
  Employee,
  PayrollEntryInput,
  PayrollPeriod,
  PayrollSummary,
} from '@/services/payroll';

const incomeTaxBrackets = [
  { limit: 110000, rate: 0.15 },
  { limit: 230000, rate: 0.2 },
  { limit: 580000, rate: 0.27 },
  { limit: 3000000, rate: 0.35 },
  { limit: null, rate: 0.4 },
];

const calculateProgressiveTax = (base: number) => {
  if (base <= 0) return 0;
  let remaining = base;
  let prevLimit = 0;
  let total = 0;

  for (const bracket of incomeTaxBrackets) {
    const limit = bracket.limit;
    const rate = bracket.rate;
    const taxable = limit === null ? remaining : Math.min(remaining, limit - prevLimit);
    total += taxable * rate;
    remaining -= taxable;
    if (remaining <= 0) break;
    if (limit !== null) prevLimit = limit;
  }
  return total;
};

const getIncomeTaxRate = (employee: Employee) => {
  if (employee.personnel_type !== 'RD_PERSONNEL') return 0;
  if (employee.education_level === 'PHD') return 0.95;
  if (employee.education_level === 'MASTER' && employee.graduation_field === 'BASIC_SCIENCES') {
    return 0.95;
  }
  if (employee.education_level === 'MASTER') return 0.9;
  if (employee.education_level === 'BACHELOR' && employee.graduation_field === 'BASIC_SCIENCES') {
    return 0.9;
  }
  if (employee.education_level === 'BACHELOR') return 0.8;
  return 0;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollProcess() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [entryMap, setEntryMap] = useState<Record<number, PayrollEntryInput>>({});
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeData, periodData] = await Promise.all([
        payrollService.listEmployees(true),
        payrollService.listPeriods(),
      ]);
      setEmployees(employeeData);
      setPeriods(periodData);
    } catch (error) {
      console.error(error);
      toast.error('Bordro verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!periods.length) return;
    const current = periods.find((p) => p.year === year && p.month === month) || null;
    setActivePeriod(current);
  }, [periods, year, month]);

  useEffect(() => {
    const initialEntries: Record<number, PayrollEntryInput> = {};
    employees.forEach((employee) => {
      initialEntries[employee.id] = {
        employee_id: employee.id,
        worked_days: 22,
        remote_days: 0,
        weekend_days: 0,
        absent_days: 0,
      };
    });
    setEntryMap(initialEntries);
  }, [employees]);

  const handleCreatePeriod = async () => {
    try {
      const period = await payrollService.createPeriod({ year, month, is_locked: false });
      toast.success('Bordro dönemi oluşturuldu');
      setActivePeriod(period);
      setPeriods((prev) => [period, ...prev]);
    } catch (error: unknown) {
      console.error(error);
      const message =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(message || 'Bordro dönemi oluşturulamadı');
    }
  };

  const handleInputChange = (employeeId: number, field: keyof PayrollEntryInput, value: number) => {
    setEntryMap((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const estimateByEmployee = useMemo(() => {
    return employees.map((employee) => {
      const entry = entryMap[employee.id];
      const gross = employee.gross_salary || 0;
      const sgkWorker = gross * 0.14;
      const unemploymentWorker = gross * 0.01;
      const incomeTaxBase = Math.max(0, gross - (sgkWorker + unemploymentWorker));
      const incomeTax = calculateProgressiveTax(incomeTaxBase);
      const exemptionRate = getIncomeTaxRate(employee);
      const incomeTaxIncentive = incomeTax * exemptionRate;
      const stampTax = gross * 0.00759;
      const stampTaxIncentive = employee.personnel_type === 'RD_PERSONNEL' ? stampTax : 0;
      const sgkEmployerIncentive = employee.personnel_type === 'RD_PERSONNEL' ? gross * 0.205 * 0.5 : 0;
      const estimatedSaving = incomeTaxIncentive + stampTaxIncentive + sgkEmployerIncentive;

      return {
        employee,
        entry,
        estimatedSaving,
        estimatedEmployerSgk: gross * (0.205 + 0.02),
        estimatedSgkIncentive: sgkEmployerIncentive,
      };
    });
  }, [employees, entryMap]);

  const summaryPreview = useMemo(() => {
    const totalPersonnelCost = estimateByEmployee.reduce((acc, item) => acc + item.employee.gross_salary, 0);
    const totalIncentive = estimateByEmployee.reduce((acc, item) => acc + item.estimatedSaving, 0);
    const totalEmployerSgk = estimateByEmployee.reduce((acc, item) => acc + item.estimatedEmployerSgk, 0);
    const totalSgkIncentive = estimateByEmployee.reduce((acc, item) => acc + item.estimatedSgkIncentive, 0);
    const payableSgk = Math.max(0, totalEmployerSgk - totalSgkIncentive);

    return {
      totalPersonnelCost,
      totalIncentive,
      payableSgk,
    };
  }, [estimateByEmployee]);

  const handleProcessPayroll = async () => {
    if (!activePeriod) {
      toast.error('Önce bordro dönemi seçin');
      return;
    }

    try {
      const entries = Object.values(entryMap);
      await payrollService.processPeriod(activePeriod.id, entries);
      const summaryData = await payrollService.getSummary(activePeriod.id);
      setSummary(summaryData);
      toast.success('Bordro hesaplandı');
    } catch (error: unknown) {
      console.error(error);
      const message =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(message || 'Bordro hesaplama başarısız');
    }
  };

  const handleDownloadReport = async () => {
    if (!activePeriod) return;
    try {
      const blob = await payrollService.downloadPersonnelReport(activePeriod.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Teknokent_Personel_Bildirim_Listesi.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('PDF indirilemedi');
    }
  };

  if (loading) {
    return <div className="container mx-auto py-8">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bordro Hesaplama</h2>
          <p className="text-sm text-gray-500">Ar-Ge günleri ve uzaktan çalışma verilerini girin.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Yıl</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Ay</Label>
            <Input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </div>
          <Button onClick={handleCreatePeriod}>Dönem Oluştur</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personel Zaman Çizelgesi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel</TableHead>
                <TableHead>Ar-Ge Gün</TableHead>
                <TableHead>Uzaktan Gün</TableHead>
                <TableHead>Tahmini Kazanç</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimateByEmployee.map(({ employee, estimatedSaving }) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.full_name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={entryMap[employee.id]?.worked_days || 0}
                      onChange={(e) => handleInputChange(employee.id, 'worked_days', Number(e.target.value))}
                      min={0}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={entryMap[employee.id]?.remote_days || 0}
                      onChange={(e) => handleInputChange(employee.id, 'remote_days', Number(e.target.value))}
                      min={0}
                    />
                  </TableCell>
                  <TableCell>{formatCurrency(estimatedSaving)} TL</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ön Muhasebe Özeti</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500">Toplam Personel Maliyeti</p>
            <p className="text-lg font-semibold">{formatCurrency(summaryPreview.totalPersonnelCost)} TL</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500">Devletin Karşıladığı Tutar (Teşvik)</p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatCurrency(summaryPreview.totalIncentive)} TL
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500">Ödenecek SGK</p>
            <p className="text-lg font-semibold">{formatCurrency(summaryPreview.payableSgk)} TL</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleProcessPayroll} disabled={!activePeriod}>
          Bordroyu Hesapla
        </Button>
        <Button variant="outline" onClick={handleDownloadReport} disabled={!activePeriod}>
          Personel Bildirim PDF
        </Button>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Kaydedilmiş Bordro Özeti</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Toplam Personel Maliyeti</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.total_personnel_cost)} TL</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Toplam Teşvik</p>
              <p className="text-lg font-semibold text-emerald-600">
                {formatCurrency(summary.total_incentive)} TL
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Ödenecek SGK</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.payable_sgk)} TL</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
