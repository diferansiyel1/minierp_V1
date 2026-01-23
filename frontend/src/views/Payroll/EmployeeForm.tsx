import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus } from 'lucide-react';
import {
  payrollService,
  Employee,
  EmployeePayload,
  GraduationField,
  PayrollEducationLevel,
  PersonnelType,
} from '@/services/payroll';

const defaultForm: EmployeePayload = {
  full_name: '',
  tc_id_no: '',
  email: '',
  is_active: true,
  start_date: undefined,
  end_date: undefined,
  personnel_type: 'RD_PERSONNEL',
  education_level: 'BACHELOR',
  graduation_field: 'ENGINEERING',
  is_student: false,
  gross_salary: 0,
};

export default function EmployeeForm() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EmployeePayload>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await payrollService.listEmployees(false);
      setEmployees(data);
    } catch (error) {
      console.error(error);
      toast.error('Personel listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const showBasicScienceBadge =
    form.graduation_field === 'BASIC_SCIENCES' && form.education_level === 'BACHELOR';
  const showPhdBadge = form.education_level === 'PHD';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await payrollService.createEmployee({
        ...form,
        gross_salary: Number(form.gross_salary || 0),
      });
      toast.success('Personel kaydı oluşturuldu');
      setForm(defaultForm);
      await loadEmployees();
    } catch (error: unknown) {
      console.error(error);
      const message =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(message || 'Personel oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="bg-violet-100 p-2 rounded-lg">
          <UserPlus className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Personel Tanımlama</h2>
          <p className="text-sm text-gray-500">
            Teknokent bordrosu için personel kartlarını eksiksiz doldurun.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Personel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Ad Soyad"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>T.C. Kimlik No</Label>
              <Input
                value={form.tc_id_no}
                onChange={(e) => setForm({ ...form, tc_id_no: e.target.value })}
                placeholder="T.C. Kimlik"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@firma.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Brüt Ücret</Label>
              <Input
                value={form.gross_salary}
                onChange={(e) => setForm({ ...form, gross_salary: Number(e.target.value) })}
                placeholder="0"
                type="number"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Personel Türü</Label>
              <Select
                value={form.personnel_type}
                onValueChange={(value) =>
                  setForm({ ...form, personnel_type: value as PersonnelType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Personel türü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RD_PERSONNEL">Ar-Ge Personeli</SelectItem>
                  <SelectItem value="SUPPORT_PERSONNEL">Destek Personeli</SelectItem>
                  <SelectItem value="INTERN">Stajyer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Eğitim Seviyesi</Label>
              <Select
                value={form.education_level}
                onValueChange={(value) =>
                  setForm({ ...form, education_level: value as PayrollEducationLevel })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Eğitim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH_SCHOOL">Lise</SelectItem>
                  <SelectItem value="ASSOCIATE">Önlisans</SelectItem>
                  <SelectItem value="BACHELOR">Lisans</SelectItem>
                  <SelectItem value="MASTER">Yüksek Lisans</SelectItem>
                  <SelectItem value="PHD">Doktora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mezuniyet Alanı</Label>
              <Select
                value={form.graduation_field}
                onValueChange={(value) =>
                  setForm({ ...form, graduation_field: value as GraduationField })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mezuniyet alanı" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENGINEERING">Mühendislik</SelectItem>
                  <SelectItem value="BASIC_SCIENCES">Temel Bilimler</SelectItem>
                  <SelectItem value="OTHER">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Başlangıç Tarihi</Label>
              <Input
                value={form.start_date || ''}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label>Çıkış Tarihi</Label>
              <Input
                value={form.end_date || ''}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                type="date"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_student"
                type="checkbox"
                checked={form.is_student}
                onChange={(e) => setForm({ ...form, is_student: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_student">Öğrenci / Stajyer</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              {showBasicScienceBadge && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  Yüksek Lisans Seviyesinde (%90) Teşvik Uygulanacak
                </Badge>
              )}
              {showPhdBadge && (
                <Badge className="bg-violet-100 text-violet-700">%95 Stopaj İstisnası</Badge>
              )}
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                Kaydet
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personel Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Yükleniyor...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>T.C.</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Brüt Ücret</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.full_name}</TableCell>
                    <TableCell>{employee.tc_id_no}</TableCell>
                    <TableCell>{employee.personnel_type}</TableCell>
                    <TableCell>
                      {employee.gross_salary.toLocaleString('tr-TR')} TL
                    </TableCell>
                    <TableCell>
                      {employee.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600">Pasif</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
