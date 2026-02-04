import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { useTranslation } from '../../hooks/useTranslation';

export default function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {t('home.readyToJoin')}
        </h2>
        <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
          {t('home.ctaSubtitle')}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button to="/admissions" variant="secondary" size="lg">
            {t('common.applyNow')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button to="/contact" size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
            {t('home.getInTouch')}
          </Button>
        </div>
      </div>
    </section>
  );
}
