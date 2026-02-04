import { schoolStats } from '../../data/siteData';
import { useTranslation } from '../../hooks/useTranslation';

export default function StatsSection() {
  const { getText } = useTranslation();

  return (
    <section className="py-12 bg-blue-600 dark:bg-blue-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {schoolStats.map((stat) => (
            <div
              key={stat.id}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-blue-100 text-sm md:text-base">
                {getText(stat.label)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
