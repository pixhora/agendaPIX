import { Toaster } from "@/components/ui/toaster";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
