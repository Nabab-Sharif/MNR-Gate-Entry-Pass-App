import { format } from 'date-fns';

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export const exportToExcel = (
  data: any[],
  columns: ExportColumn[],
  filename: string
) => {
  if (data.length === 0) {
    return;
  }

  // Create CSV content
  const headers = columns.map(col => col.label).join(',');
  
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key];
      
      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }
      
      // Apply format if provided
      if (col.format) {
        value = col.format(value);
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Escape commas and quotes in values
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  }).join('\n');
  
  const csvContent = `${headers}\n${rows}`;
  
  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Common column formatters
export const formatDate = (date: string) => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy HH:mm');
};

export const formatDateOnly = (date: string) => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy');
};

// Product export columns (without status)
export const productExportColumns: ExportColumn[] = [
  { key: 'name', label: 'Product Name' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'sender_name', label: 'Sender' },
  { key: 'receiver_name', label: 'Receiver' },
  { key: 'gates.name', label: 'Gate' },
  { key: 'departments.name', label: 'Department' },
  { key: 'created_at', label: 'Entry Date', format: formatDateOnly },
];

// Gate pass export columns (without status)
export const gatePassExportColumns: ExportColumn[] = [
  { key: 'product_name', label: 'Product Name' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'sender_name', label: 'Sender' },
  { key: 'receiver_name', label: 'Receiver' },
  { key: 'stores.name', label: 'Store' },
  { key: 'departments.name', label: 'Department' },
  { key: 'created_at', label: 'Created Date', format: formatDateOnly },
];
