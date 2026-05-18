import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <TopNav />
      <Sidebar />
      <main className="rr-main">{children}</main>
    </>
  );
}
