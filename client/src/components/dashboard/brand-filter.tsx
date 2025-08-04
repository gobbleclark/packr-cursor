import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface BrandFilterProps {
  onBrandChange: (brandId: string) => void;
  userRole?: string;
}

export default function BrandFilter({ onBrandChange, userRole }: BrandFilterProps) {
  const [selectedBrand, setSelectedBrand] = useState("all");

  // Only show brand filter for 3PL users
  if (userRole !== 'threePL') {
    return null;
  }

  const { data: brands } = useQuery({
    queryKey: ["/api/brands"],
    queryFn: async () => {
      const response = await fetch("/api/brands");
      if (!response.ok) throw new Error("Failed to fetch brands");
      return response.json();
    },
  });

  const handleBrandChange = (brandId: string) => {
    setSelectedBrand(brandId);
    onBrandChange(brandId);
  };

  // Initialize with "all" brands
  useEffect(() => {
    onBrandChange("all");
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-2">
        <Building2 className="h-4 w-4 text-gray-500" />
        <Label htmlFor="brand-filter" className="text-sm font-medium">
          Brand:
        </Label>
      </div>
      
      <Select value={selectedBrand} onValueChange={handleBrandChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Brands</SelectItem>
          {brands?.map((brand: any) => (
            <SelectItem key={brand.id} value={brand.id}>
              {brand.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}