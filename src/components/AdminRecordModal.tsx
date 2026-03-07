import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { toIsoDateTime } from '../dateTimeUtils';

type AdminStatus = 'given' | 'not-given' | 'third-party' | null;

type AdminRecord = {
  medId: string;
  time: string;
  medName: string;
} | null;

type Props = {
  visible: boolean;
  adminRecord: AdminRecord;
  adminStatus: AdminStatus;
  setAdminStatus: (status: AdminStatus) => void;
  adminScheduledTime: string;
  adminActualTime: string;
  setAdminActualTime: (value: string) => void;
  adminTabletsGiven: string;
  setAdminTabletsGiven: (value: string) => void;
  adminNotes: string;
  setAdminNotes: (value: string) => void;
  administeredBy: string;
  setAdministeredBy: (value: string) => void;
  notGivenReason: string;
  setNotGivenReason: (value: any) => void;
  otherReason: string;
  setOtherReason: (value: string) => void;
  medRoute?: string;
  isPrn?: boolean;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  styles: any;
};

export function AdminRecordModal({
  visible,
  adminRecord,
  adminStatus,
  setAdminStatus,
  adminScheduledTime,
  adminActualTime,
  setAdminActualTime,
  adminTabletsGiven,
  setAdminTabletsGiven,
  adminNotes,
  setAdminNotes,
  administeredBy,
  setAdministeredBy,
  notGivenReason,
  setNotGivenReason,
  otherReason,
  setOtherReason,
  medRoute,
  isPrn,
  onCancel,
  onSave,
  canSave,
  styles,
}: Props) {
  const [showAdminTimePicker, setShowAdminTimePicker] = useState(false);
  const [adminPickerYear, setAdminPickerYear] = useState(new Date().getFullYear());
  const [adminPickerMonth, setAdminPickerMonth] = useState(new Date().getMonth() + 1);
  const [adminPickerDay, setAdminPickerDay] = useState(new Date().getDate());
  const [adminPickerHour, setAdminPickerHour] = useState(new Date().getHours());
  const [adminPickerMinute, setAdminPickerMinute] = useState(new Date().getMinutes());

  function openAdminTimePicker() {
    const now = new Date();
    setAdminPickerYear(now.getFullYear());
    setAdminPickerMonth(now.getMonth() + 1);
    setAdminPickerDay(now.getDate());
    setAdminPickerHour(now.getHours());
    setAdminPickerMinute(Math.floor(now.getMinutes() / 5) * 5);
    setShowAdminTimePicker(true);
  }

  function confirmAdminTimePicker() {
    const formatted = toIsoDateTime(
      adminPickerYear,
      adminPickerMonth,
      adminPickerDay,
      adminPickerHour,
      adminPickerMinute
    );
    setAdminActualTime(formatted);
    setShowAdminTimePicker(false);
  }

  const showTabletCount = medRoute
    ? medRoute.toLowerCase().includes('tablet') || medRoute.toLowerCase().includes('capsule')
    : false;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.adminModalHeader}>
            <Text style={styles.modalTitle}>Record Administration</Text>
            <Text style={styles.adminModalSubtitle}>{adminRecord?.medName}</Text>
          </View>

          {!adminStatus ? (
            <View style={styles.adminStatusButtons}>
              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('given')}
              >
                <Text style={styles.adminStatusButtonLabel}>✓ Given</Text>
                <Text style={styles.adminStatusButtonDesc}>Dose was administered</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('not-given')}
              >
                <Text style={styles.adminStatusButtonLabel}>✗ Not Given</Text>
                <Text style={styles.adminStatusButtonDesc}>Dose was not taken</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('third-party')}
              >
                <Text style={styles.adminStatusButtonLabel}>👤 Third Party</Text>
                <Text style={styles.adminStatusButtonDesc}>Administered by another person</Text>
              </TouchableOpacity>
            </View>
          ) : adminStatus === 'given' || adminStatus === 'third-party' ? (
            <View style={styles.adminFormSection}>
              {!isPrn && (
                <>
                  <Text style={styles.adminFormLabel}>Scheduled Time</Text>
                  <View style={[styles.adminFormInput, { justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f0f9ff' }]}>
                    <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>{adminScheduledTime}</Text>
                  </View>
                </>
              )}

              <Text style={styles.adminFormLabel}>Actual Administration Time *</Text>
              <TouchableOpacity
                style={[styles.adminFormInput, { justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderColor: adminStatus === 'given' && !adminActualTime ? '#dc2626' : '#d1d5db' }]}
                onPress={openAdminTimePicker}
              >
                <Text style={{ color: adminActualTime ? '#000' : '#999', fontSize: 16 }}>
                  {adminActualTime ? new Date(adminActualTime).toLocaleString() : 'Tap to select date & time'}
                </Text>
              </TouchableOpacity>

              {showTabletCount && (
                <>
                  <Text style={styles.adminFormLabel}>Number of {medRoute} *</Text>
                  <TextInput
                    style={[styles.adminFormInput, !adminTabletsGiven && { borderColor: '#dc2626', borderWidth: 2 }]}
                    placeholder="Enter number (required)"
                    value={adminTabletsGiven}
                    onChangeText={setAdminTabletsGiven}
                    keyboardType="number-pad"
                  />
                </>
              )}

              <Text style={styles.adminFormLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.adminFormInput, styles.multilineInput]}
                placeholder="Any additional notes..."
                value={adminNotes}
                onChangeText={setAdminNotes}
                multiline
              />

              {adminStatus === 'third-party' && (
                <>
                  <Text style={styles.adminFormLabel}>Administered by</Text>
                  <TextInput
                    style={styles.adminFormInput}
                    placeholder="Name of person"
                    value={administeredBy}
                    onChangeText={setAdministeredBy}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.adminFormSection}>
              <Text style={styles.adminFormLabel}>Reason not given</Text>
              {['refused', 'out-of-stock', 'missed', 'schedule-conflict', 'other'].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonOption, notGivenReason === reason && styles.reasonOptionSelected]}
                  onPress={() => setNotGivenReason(reason as any)}
                >
                  <Text style={[styles.reasonOptionText, notGivenReason === reason && styles.reasonOptionTextSelected]}>
                    {reason.charAt(0).toUpperCase() + reason.slice(1).replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
              {notGivenReason === 'other' && (
                <TextInput
                  style={styles.adminFormInput}
                  placeholder="Please specify reason"
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                />
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel]}
              onPress={onCancel}
            >
              <Text style={styles.modalBtnText}>{adminStatus ? 'Back' : 'Cancel'}</Text>
            </TouchableOpacity>
            {adminStatus && (
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={onSave}
                disabled={!canSave}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <Modal visible={showAdminTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '95%', maxWidth: 550, maxHeight: '90%', padding: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Select Administration Date & Time</Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#10b981', borderRadius: 4 }}
                onPress={() => {
                  const now = new Date();
                  setAdminPickerYear(now.getFullYear());
                  setAdminPickerMonth(now.getMonth() + 1);
                  setAdminPickerDay(now.getDate());
                  setAdminPickerHour(now.getHours());
                  setAdminPickerMinute(Math.floor(now.getMinutes() / 5) * 5);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Now</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f0f9ff', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#93c5fd' }}>
              <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4 }}>Selected</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#2563eb' }}>
                {new Date(adminPickerYear, adminPickerMonth - 1, adminPickerDay, adminPickerHour, adminPickerMinute).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#111', fontSize: 14 }}>Date</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 0.8 }}>
                    <Text style={{ fontWeight: '500', marginBottom: 4, color: '#666', fontSize: 11 }}>Year</Text>
                    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 100 }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {Array.from({ length: 5 }, (_, i) => 2026 + i).map(year => (
                          <TouchableOpacity
                            key={year}
                            style={[
                              { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                              adminPickerYear === year && { backgroundColor: '#dbeafe' }
                            ]}
                            onPress={() => setAdminPickerYear(year)}
                          >
                            <Text style={[
                              { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
                              adminPickerYear === year && { color: '#2563eb', fontWeight: '700' }
                            ]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                         ))}
                       </ScrollView>
                     </View>
                   </View>

                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: '500', marginBottom: 4, color: '#666', fontSize: 11 }}>Month</Text>
                     <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 100 }}>
                       <ScrollView showsVerticalScrollIndicator={false}>
                         {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                           <TouchableOpacity
                             key={m}
                             style={[
                               { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                               adminPickerMonth === idx + 1 && { backgroundColor: '#dbeafe' }
                             ]}
                             onPress={() => setAdminPickerMonth(idx + 1)}
                           >
                             <Text style={[
                               { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
                               adminPickerMonth === idx + 1 && { color: '#2563eb', fontWeight: '700' }
                             ]}>
                               {m}
                             </Text>
                           </TouchableOpacity>
                         ))}
                       </ScrollView>
                     </View>
                   </View>

                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: '500', marginBottom: 4, color: '#666', fontSize: 11 }}>Day</Text>
                     <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 100 }}>
                       <ScrollView showsVerticalScrollIndicator={false}>
                         {Array.from({ length: new Date(adminPickerYear, adminPickerMonth, 0).getDate() }, (_, i) => i + 1).map(day => (
                           <TouchableOpacity
                             key={day}
                             style={[
                               { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                               adminPickerDay === day && { backgroundColor: '#2563eb' }
                             ]}
                             onPress={() => setAdminPickerDay(day)}
                           >
                             <Text style={[
                               { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
                               adminPickerDay === day && { color: '#fff', fontWeight: '700' }
                             ]}>
                               {day}
                             </Text>
                           </TouchableOpacity>
                         ))}
                       </ScrollView>
                     </View>
                   </View>
                 </View>
               </View>

               <View style={{ marginBottom: 16 }}>
                 <Text style={{ fontWeight: '600', marginBottom: 8, color: '#111', fontSize: 14 }}>Time</Text>
                 <View style={{ flexDirection: 'row', gap: 10 }}>
                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: '500', marginBottom: 4, color: '#666', fontSize: 11 }}>Hour</Text>
                     <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden' }}>
                       <ScrollView
                         style={{ height: 170 }}
                         showsVerticalScrollIndicator={false}
                       >
                         {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                           <TouchableOpacity
                             key={hour}
                             style={[
                               { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                               adminPickerHour === hour && { backgroundColor: '#2563eb' }
                             ]}
                             onPress={() => setAdminPickerHour(hour)}
                           >
                             <Text style={[
                               { fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center' },
                               adminPickerHour === hour && { color: '#fff', fontWeight: '800' }
                             ]}>
                               {String(hour).padStart(2, '0')}
                             </Text>
                           </TouchableOpacity>
                         ))}
                       </ScrollView>
                     </View>
                   </View>

                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: '500', marginBottom: 4, color: '#666', fontSize: 11 }}>Minute</Text>
                     <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden' }}>
                       <ScrollView
                         style={{ height: 170 }}
                         showsVerticalScrollIndicator={false}
                       >
                         {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
                           <TouchableOpacity
                             key={minute}
                             style={[
                               { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                               adminPickerMinute === minute && { backgroundColor: '#2563eb' }
                             ]}
                             onPress={() => setAdminPickerMinute(minute)}
                           >
                             <Text style={[
                               { fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center' },
                               adminPickerMinute === minute && { color: '#fff', fontWeight: '800' }
                             ]}>
                               {String(minute).padStart(2, '0')}
                             </Text>
                           </TouchableOpacity>
                         ))}
                       </ScrollView>
                     </View>
                   </View>
                 </View>
               </View>
             </ScrollView>

             <View style={[styles.modalActions, { marginTop: 12 }]}>
               <TouchableOpacity
                 style={[styles.modalBtn, styles.modalCancel]}
                 onPress={() => setShowAdminTimePicker(false)}
               >
                 <Text style={styles.modalBtnText}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.modalBtn, styles.modalSave]}
                 onPress={confirmAdminTimePicker}
               >
                 <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </Modal>
  );
}
