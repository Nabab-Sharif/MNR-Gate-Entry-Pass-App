 import React, { useState, useRef } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Calendar } from '@/components/ui/calendar';
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from '@/components/ui/popover';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { 
   Printer, 
   CalendarIcon, 
   Download,
   FileText
 } from 'lucide-react';
 import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
 import { cn } from '@/lib/utils';
 import { exportToExcel, formatDateOnly } from '@/utils/exportToExcel';
 import { toast } from 'sonner';
 
 interface Product {
   id: string;
   name: string;
   quantity: number;
   status: string;
   sender_name: string | null;
   receiver_name: string | null;
   created_at: string;
   department_id?: string | null;
   departments?: { name: string };
   gates?: { name: string };
 }
 
 interface GatePass {
   id: string;
   product_name: string;
   quantity: number;
   status: string;
   purpose: string;
   sender_name: string | null;
   receiver_name: string | null;
   created_at: string;
   department_id?: string | null;
   departments?: { name: string };
   stores?: { name: string };
 }
 
 interface DepartmentFilter {
   id: string;
   name: string;
 }
 
 interface GateEntryPrintDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   products?: Product[];
   items?: (Product | GatePass)[];
   mode?: 'entries' | 'passes';
   departments?: DepartmentFilter[];
   gateName: string;
   officeName: string;
 }
 
 type FilterType = 'today' | 'daily' | 'monthly' | 'custom';
 
 const GateEntryPrintDialog: React.FC<GateEntryPrintDialogProps> = ({
   open,
   onOpenChange,
   products,
   items,
   mode = 'entries',
   departments,
   gateName,
   officeName
 }) => {
   const [filterType, setFilterType] = useState<FilterType>('today');
   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
   const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
   const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
     from: undefined,
     to: undefined
   });
   const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
   const printRef = useRef<HTMLDivElement>(null);
 
   const itemsToFilter = items ?? products ?? [];
 
   const getFilteredProducts = () => {
     const now = new Date();
     
     return itemsToFilter.filter(item => {
       const productDate = new Date(item.created_at);
       
       let matchesDate = true;
       switch (filterType) {
         case 'today':
           matchesDate = productDate >= startOfDay(now) && productDate <= endOfDay(now);
           break;
         case 'daily':
           matchesDate = productDate >= startOfDay(selectedDate) && productDate <= endOfDay(selectedDate);
           break;
         case 'monthly':
           matchesDate = productDate >= startOfMonth(selectedMonth) && productDate <= endOfMonth(selectedMonth);
           break;
         case 'custom':
           if (dateRange.from && dateRange.to) {
             matchesDate = productDate >= startOfDay(dateRange.from) && productDate <= endOfDay(dateRange.to);
           }
           break;
       }
 
       const matchesDepartment = selectedDepartmentId && selectedDepartmentId !== 'all'
         ? item.department_id === selectedDepartmentId
         : true;
 
       return matchesDate && matchesDepartment;
     });
   };
 
   const filteredProducts = getFilteredProducts();
 
   const handlePrint = () => {
     const printContent = printRef.current;
     if (!printContent) return;
 
     const printWindow = window.open('', '_blank');
     if (!printWindow) return;
 
     const dateLabel = filterType === 'today' 
       ? format(new Date(), 'dd MMM yyyy')
       : filterType === 'daily'
       ? format(selectedDate, 'dd MMM yyyy')
       : filterType === 'monthly'
       ? format(selectedMonth, 'MMMM yyyy')
       : dateRange.from && dateRange.to
       ? `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`
       : 'All';
 
const departmentLabel = selectedDepartmentId === 'all'
      ? 'All Departments'
      : departments?.find((dept) => dept.id === selectedDepartmentId)?.name || 'Selected Department';
 
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title></title>
          <style>
            @page { size: auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e3a5f; padding-bottom: 15px; }
            .header h1 { color: #1e3a5f; font-size: 24px; }
            .header p { color: #666; font-size: 14px; margin-top: 5px; }
            .info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #1e3a5f; color: white; }
            tr:nth-child(even) { background: #f9f9f9; }
            .stats { display: flex; gap: 20px; margin-bottom: 15px; }
            .stat { background: #f0f4f8; padding: 10px 15px; border-radius: 5px; }
            .stat-label { font-size: 10px; color: #666; }
            .stat-value { font-size: 18px; font-weight: bold; color: #1e3a5f; }
            @media print { 
              html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
              body { padding: 20px; }
              @page { margin: 0; }
            }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${gateName} - ${mode === 'passes' ? 'Gate Pass Report' : 'Gate Entry Report'}</h1>
            <p>${officeName} | ${dateLabel} | ${departmentLabel}</p>
          </div>
          <div class="stats">
            <div class="stat">
              <div class="stat-label">Total ${mode === 'passes' ? 'Passes' : 'Entries'}</div>
              <div class="stat-value">${filteredProducts.length}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Total Quantity</div>
              <div class="stat-value">${filteredProducts.reduce((sum, p) => sum + p.quantity, 0)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${mode === 'passes' ? 'Gate Pass' : 'Product Name'}</th>
                <th>Department</th>
                ${mode === 'passes' ? '<th>Store</th>' : ''}
                <th>Qty</th>
                ${mode === 'passes' ? '<th>Status</th>' : '<th>Sender</th>'}
                ${mode === 'passes' ? '<th>Purpose</th>' : '<th>Receiver</th>'}
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.map((product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${mode === 'passes' ? (product as GatePass).product_name : (product as Product).name}</td>
                  <td>${product.departments?.name || '-'}</td>
                  ${mode === 'passes' ? `<td>${(product as GatePass).stores?.name || '-'}</td>` : ''}
                  <td>${product.quantity}</td>
                  ${mode === 'passes' ? `<td>${(product as GatePass).status || '-'}</td>` : `<td>${product.sender_name || '-'}</td>`}
                  ${mode === 'passes' ? `<td>${(product as GatePass).purpose || '-'}</td>` : `<td>${product.receiver_name || '-'}</td>`}
                  <td>${format(new Date(product.created_at), 'dd/MM/yy')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.print();
   };
 
  const handleExport = () => {
    const columns = mode === 'passes' ? [
      { key: 'product_name', label: 'Gate Pass' },
      { key: 'departments.name', label: 'Department' },
      { key: 'stores.name', label: 'Store' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'status', label: 'Status' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'created_at', label: 'Date', format: formatDateOnly }
    ] : [
      { key: 'name', label: 'Product Name' },
      { key: 'departments.name', label: 'Department' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'sender_name', label: 'Sender' },
      { key: 'receiver_name', label: 'Receiver' },
      { key: 'created_at', label: 'Date', format: formatDateOnly }
    ];

    exportToExcel(filteredProducts, columns, `${mode === 'passes' ? 'gate-passes' : 'gate-entries'}-${gateName}`);
    toast.success('Exported successfully!');
  };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-lg">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Printer className="h-5 w-5 text-primary" />
             Print/Export {mode === 'passes' ? 'Gate Passes' : 'Gate Entries'}
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Filter Type Selection */}
           <div className="space-y-2">
             <label className="text-sm font-medium">Filter By</label>
             <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="today">Today</SelectItem>
                 <SelectItem value="daily">Specific Date</SelectItem>
                 <SelectItem value="monthly">Monthly</SelectItem>
                 <SelectItem value="custom">Custom Range</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           {departments && departments.length > 0 && (
             <div className="space-y-2">
               <label className="text-sm font-medium">Department</label>
               <Select value={selectedDepartmentId} onValueChange={(value) => setSelectedDepartmentId(value)}>
                 <SelectTrigger>
                   <SelectValue placeholder="All Departments" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Departments</SelectItem>
                   {departments.map((dept) => (
                     <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           )}
 
           {/* Date Pickers based on filter type */}
           {filterType === 'daily' && (
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" className="w-full justify-start">
                   <CalendarIcon className="h-4 w-4 mr-2" />
                   {format(selectedDate, 'dd MMM yyyy')}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                   mode="single"
                   selected={selectedDate}
                   onSelect={(date) => date && setSelectedDate(date)}
                   initialFocus
                 />
               </PopoverContent>
             </Popover>
           )}
 
           {filterType === 'monthly' && (
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" className="w-full justify-start">
                   <CalendarIcon className="h-4 w-4 mr-2" />
                   {format(selectedMonth, 'MMMM yyyy')}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                   mode="single"
                   selected={selectedMonth}
                   onSelect={(date) => date && setSelectedMonth(date)}
                   initialFocus
                 />
               </PopoverContent>
             </Popover>
           )}
 
           {filterType === 'custom' && (
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" className="w-full justify-start">
                   <CalendarIcon className="h-4 w-4 mr-2" />
                   {dateRange.from ? (
                     dateRange.to ? (
                       `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`
                     ) : (
                       format(dateRange.from, 'dd MMM yyyy')
                     )
                   ) : (
                     'Select date range'
                   )}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                   mode="range"
                   selected={{ from: dateRange.from, to: dateRange.to }}
                   onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                   numberOfMonths={2}
                   initialFocus
                 />
               </PopoverContent>
             </Popover>
           )}
 
           {/* Preview Stats */}
           <div className="p-4 rounded-lg bg-muted/50 border">
             <div className="grid grid-cols-2 gap-4 text-center">
               <div>
                 <p className="text-2xl font-bold text-primary">{filteredProducts.length}</p>
                 <p className="text-xs text-muted-foreground">Total {mode === 'passes' ? 'Passes' : 'Entries'}</p>
               </div>
               <div>
                 <p className="text-2xl font-bold text-success">{filteredProducts.reduce((sum, p) => sum + p.quantity, 0)}</p>
                 <p className="text-xs text-muted-foreground">Total Quantity</p>
               </div>
             </div>
           </div>
 
           {/* Action Buttons */}
           <div className="flex gap-2">
             <Button onClick={handlePrint} className="flex-1 gap-2">
               <Printer className="h-4 w-4" />
               Print Report
             </Button>
             <Button variant="outline" onClick={handleExport} className="flex-1 gap-2">
               <Download className="h-4 w-4" />
               Export Excel
             </Button>
           </div>
         </div>
 
         <div ref={printRef} className="hidden" />
       </DialogContent>
     </Dialog>
   );
 };
 
 export default GateEntryPrintDialog;