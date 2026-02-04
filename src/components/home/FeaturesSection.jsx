import { BookOpen, Shield, Trophy, Palette, Monitor, Users } from 'lucide-react';
import Card, { CardBody } from '../ui/Card';
import { features } from '../../data/siteData';
import { useTranslation } from '../../hooks/useTranslation';

const iconMap = {
  BookOpen,
  Shield,
  Trophy,
  Palette,
  Monitor,
  Users,
};

export default function FeaturesSection() {
  const { getText, t } = useTranslation();

  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-4">
            {t('home.whyChooseUs')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('home.whatMakesUsSpecial')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('home.featuresSubtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <Card key={feature.id}>
                <CardBody className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mb-6">
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    {getText(feature.title)}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {getText(feature.description)}
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
