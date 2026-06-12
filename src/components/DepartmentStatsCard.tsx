 import React from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Users, Package, FileText, ArrowRight } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface DepartmentStats {
   id: string;
   name: string;
   productCount: number;
   gatePassCount: number;
 }
 
 interface DepartmentStatsCardProps {
   department: DepartmentStats;
   onClick: () => void;
 }
 
 const DepartmentStatsCard: React.FC<DepartmentStatsCardProps> = ({ department, onClick }) => {
   return (
     <Card 
       className="group cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all duration-300"
       onClick={onClick}
     >
       <CardContent className="p-2.5 sm:p-4">
         <div className="flex items-start justify-between gap-2">
           <div className="flex items-start gap-2 flex-1 min-w-0">
             <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors flex-shrink-0">
               <Users className="h-3 sm:h-5 w-3 sm:w-5 text-warning" />
             </div>
             <div className="min-w-0 flex-1">
               <h3 className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
                 {department.name}
               </h3>
               <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mt-0.5 sm:mt-1">
                 <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                   <Package className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-info flex-shrink-0" />
                   <span className="truncate">{department.productCount} entries</span>
                 </span>
                 <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                   <FileText className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-success flex-shrink-0" />
                   <span className="truncate">{department.gatePassCount} passes</span>
                 </span>
               </div>
             </div>
           </div>
           <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-0.5" />
         </div>
       </CardContent>
     </Card>
   );
 };
 
 export default DepartmentStatsCard;