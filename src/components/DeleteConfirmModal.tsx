import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  medName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmModal({ visible, medName, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Delete Medication?</Text>
          <Text style={styles.message}>
            Are you sure you want to delete <Text style={styles.medName}>{medName}</Text>?
            This action cannot be undone, but the history will be preserved.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: '#fff' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1f2937',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  medName: {
    fontWeight: '600',
    color: '#1f2937',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelBtn: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  confirmBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
