import { AdminLayout } from '../../../components/Layout';

export function CafeDashboard() {
  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">CAIXINHA DO CAFÉ</h1>

      <div className="bg-white rounded-2xl p-8 border border-borda shadow-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-4xl mb-4">☕</div>
        <h2 className="font-display text-xl text-azul tracking-wider mb-2">EM CONSTRUÇÃO</h2>
        <p className="text-texto-fraco text-sm max-w-md mx-auto">
          Controle de mensalidades do café para oficiais e graduados, com gestão de estoque de insumos — café, açúcar, copos, bolachas.
        </p>
      </div>
    </AdminLayout>
  );
}
