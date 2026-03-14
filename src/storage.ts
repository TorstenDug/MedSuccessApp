import AsyncStorage from '@react-native-async-storage/async-storage';

export type Medication = {
  id: string;
  name: string;
  medicationPurpose?: string;
  totalDose?: string;
  dosePerTablet?: string;
  dosePerTablet2?: string;
  dosePerTablet2Unit?: string;
  multipleDosesPerTablet?: boolean;
  unit?: string;
  route?: string;
  prnVariableMinHoursBetween?: number;
  prnVariableMaxDosePerAdministration?: number;
  prnVariableMaxDosePer24Hours?: number;
  // start date and time (ISO string)
  startTime?: string;
  // optional end date (ISO string)
  endTime?: string;
  // scheduled times for doses (ISO strings)
  scheduledTimes?: string[];
  // administration records for scheduled instances
  administrationRecords?: { time: string; status: 'given' | 'missed' | 'created' | 'deleted' | 'discontinued' | 'stock-adjustment' | 'error-correction'; actualTime?: string; reason?: string; tabletsGiven?: number }[];
  // PRN (as-needed) medication
  prn?: boolean;
  // notes about the medication
  notes?: string;
  // stock level
  stock?: number;
  // stock unit label (e.g., pens, single use injections, units, ml)
  stockUnit?: string;
  // medication expiry date (optional, ISO string)
  expiryDate?: string;
  // frequency type for scheduling (daily, every-second-day, weekly, fortnightly, monthly)
  frequencyType?: 'daily' | 'every-second-day' | 'weekly' | 'fortnightly' | 'monthly';
  // medication course type for timeline horizon logic
  courseType?: 'long-term' | 'short-term';
  // variable dose instructions (for medications like insulin)
  variableDoseInstructions?: string;
  // pharmacy collection tracking (optional)
  pharmacyCollectedDate?: string;
  pharmacyCollectedTime?: string;
  pharmacyCollectedInitials?: string;
  pharmacyName?: string;
  hasScriptRepeats?: boolean;
  scriptRepeatsCount?: number;
  prescriptionFileUri?: string;
  scriptLocation?: 'Pharmacy file' | 'Home office' | 'Clients possession' | 'Management office' | 'Other';
  scriptLocationOtherDetail?: string;
};

export type Client = {
  id: string;
  name: string;
  dob?: string;
  allergies?: string;
  additionalInfo?: string;
  medications?: Medication[];
  photoUri?: string;
  gender?: 'Male' | 'Female' | 'Other';
  weight?: string;
  contactEmail?: string;
  gp?: string;
  gpClinic?: string;
  medicareNumber?: string;
  // Archive of deleted medication administration records
  archivedMedicationHistory?: { medName: string; records: { time: string; status: string; actualTime?: string; reason?: string; tabletsGiven?: number }[] }[];
};

export type Location = {
  id: string;
  name: string;
  clients: Client[];
};

const STORAGE_KEY = 'medsuccess:data:v1';

export async function loadData(): Promise<Location[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Location[];
  } catch (e) {
    console.warn('loadData error', e);
    return [];
  }
}

export async function saveData(data: Location[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('saveData error', e);
  }
}

export async function addLocation(name: string) {
  const data = await loadData();
  const loc: Location = { id: Date.now().toString(), name, clients: [] };
  data.push(loc);
  await saveData(data);
  return loc;
}

export async function addClient(locationId: string, client: Omit<Client, 'id'>) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const newClient: Client = { ...client, id: Date.now().toString() };
  loc.clients.push(newClient);
  await saveData(data);
  return newClient;
}

export async function updateClient(locationId: string, client: Client) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const idx = loc.clients.findIndex((c) => c.id === client.id);
  if (idx === -1) throw new Error('Client not found');
  loc.clients[idx] = client;
  await saveData(data);
}

export async function deleteClient(locationId: string, clientId: string) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const idx = loc.clients.findIndex((c) => c.id === clientId);
  if (idx === -1) throw new Error('Client not found');
  const [removed] = loc.clients.splice(idx, 1);
  await saveData(data);
  return removed;
}

export async function addMedication(locationId: string, clientId: string, med: Omit<Medication, 'id'>) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const client = loc.clients.find((c) => c.id === clientId);
  if (!client) throw new Error('Client not found');
  const newMed: Medication = { ...med, id: Date.now().toString(), stock: med.stock ?? 0 };
  client.medications = client.medications || [];
  client.medications.push(newMed);
  await saveData(data);
  return newMed;
}

export async function updateMedication(locationId: string, clientId: string, medication: Medication) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const client = loc.clients.find((c) => c.id === clientId);
  if (!client) throw new Error('Client not found');
  client.medications = client.medications || [];
  const idx = client.medications.findIndex((m) => m.id === medication.id);
  if (idx === -1) {
    client.medications.push(medication);
  } else {
    client.medications[idx] = medication;
  }
  await saveData(data);
  return medication;
}

export async function addAdministrationRecord(locationId: string, clientId: string, medicationId: string, timeIso: string, status: 'given' | 'missed' | 'created' | 'deleted' | 'discontinued' | 'stock-adjustment' | 'error-correction', actualTime?: string, reason?: string, tabletsGiven?: number) {
  const data = await loadData();
  const loc = data.find((l) => l.id === locationId);
  if (!loc) throw new Error('Location not found');
  const client = loc.clients.find((c) => c.id === clientId);
  if (!client) throw new Error('Client not found');
  const med = client.medications?.find((m) => m.id === medicationId);
  if (!med) throw new Error('Medication not found');
  med.administrationRecords = med.administrationRecords || [];
  med.administrationRecords.push({ time: timeIso, status, actualTime, reason, tabletsGiven });
  await saveData(data);
  return med;
}
