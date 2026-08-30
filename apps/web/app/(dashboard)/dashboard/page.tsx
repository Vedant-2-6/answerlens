import { FileText, Clock, Users, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text mb-1">Welcome back, Professor</h1>
          <p className="text-text-muted">Here's what's happening with your classes today.</p>
        </div>
        <button className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          Grade New Exam
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Papers Graded" value="1,248" icon={FileText} trend="+12% this week" />
        <StatCard title="Average Class Score" value="76%" icon={Users} trend="Consistent" />
        <StatCard title="Hours Saved" value="142" icon={Clock} trend="+8 hours this week" />
      </div>

      <h2 className="text-xl font-bold text-text mb-4">Recent Batches</h2>
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface/50 border-b border-border text-sm text-text-muted">
              <th className="p-4 font-medium">Exam Name</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Progress</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <BatchRow name="Data Structures - Midterm" date="Oct 12, 2026" progress="50/50" status="Completed" />
            <BatchRow name="Algorithms - Quiz 3" date="Oct 10, 2026" progress="120/120" status="Completed" />
            <BatchRow name="Operating Systems - Final" date="Oct 08, 2026" progress="45/45" status="Needs Review" warning />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-border shadow-sm flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-accent/10 text-accent rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-medium text-text-muted">{title}</h3>
      </div>
      <div className="text-3xl font-bold text-text mb-1">{value}</div>
      <div className="text-sm text-green-600 flex items-center gap-1">
        <ArrowUpRight className="w-4 h-4" /> {trend}
      </div>
    </div>
  );
}

function BatchRow({ name, date, progress, status, warning }: any) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface/30 transition-colors">
      <td className="p-4 font-medium text-text">{name}</td>
      <td className="p-4 text-text-muted">{date}</td>
      <td className="p-4 text-text">{progress}</td>
      <td className="p-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          warning ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
        }`}>
          {status}
        </span>
      </td>
      <td className="p-4 text-right">
        <button className="text-accent hover:text-accent-dark font-medium text-sm">View</button>
      </td>
    </tr>
  );
}
