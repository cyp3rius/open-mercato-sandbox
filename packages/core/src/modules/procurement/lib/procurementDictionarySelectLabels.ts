import type { DictionarySelectLabels } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'

type Translate = (key: string, fallback?: string) => string

export function procurementDictionarySelectLabels(
  t: Translate,
  which: 'status' | 'type' | 'unit',
): DictionarySelectLabels {
  const placeholder =
    which === 'status'
      ? t('procurement.processes.detail.dict.status.placeholder', 'Select status…')
      : which === 'type'
        ? t('procurement.processes.detail.dict.type.placeholder', 'Select type…')
        : t('procurement.processes.detail.dict.unit.placeholder', 'Select unit…')

  return {
    placeholder,
    addLabel: t('customers.people.form.dictionary.add', 'Add option'),
    addPrompt: t('customers.people.form.dictionary.prompt', 'Name your option'),
    dialogTitle: t('customers.people.form.dictionary.dialogTitle', 'Add option'),
    valueLabel: t('customers.people.form.dictionary.valueLabel', 'Name'),
    valuePlaceholder: t('customers.people.form.dictionary.valuePlaceholder', 'Name'),
    labelLabel: t('customers.people.form.dictionary.labelLabel', 'Label'),
    labelPlaceholder: t('customers.people.form.dictionary.labelPlaceholder', 'Display name shown in UI'),
    emptyError: t('customers.people.form.dictionary.errorRequired', 'Please enter a name'),
    cancelLabel: t('customers.people.form.dictionary.cancel', 'Cancel'),
    saveLabel: t('customers.people.form.dictionary.save', 'Save'),
    saveShortcutHint: t('customers.people.form.dictionary.saveShortcut', 'Cmd/Ctrl + Enter'),
    errorLoad: t('customers.people.form.dictionary.errorLoad', 'Failed to load options'),
    errorSave: t('customers.people.form.dictionary.error', 'Failed to save option'),
    loadingLabel: t('customers.people.form.dictionary.loading', 'Loading…'),
    manageTitle: t('procurement.processes.detail.dict.manage', 'Manage dictionary'),
  }
}
