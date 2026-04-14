import { ProjectList } from '@/components/dashboard/project-list';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#282c34]">
      <header className="border-b border-[#3e4451] bg-[#21252b]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-[#abb2bf]">LaTeX IDE</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <ProjectList />
      </main>
    </div>
  );
}
