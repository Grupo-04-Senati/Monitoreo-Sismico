import ModuleStub from "@/components/layout/ModuleStub";

export default function EstimacionesPage() {
  return (
    <ModuleStub
      title="Estimaciones"
      actions={
        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full dark:bg-purple-900 dark:text-purple-200">
          Estimación experimental — no es alerta oficial
        </span>
      }
    />
  );
}
