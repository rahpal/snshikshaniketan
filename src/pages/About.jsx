import { Target, Eye, Heart, Star, Users, Award } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import { aboutContent, schoolInfo, schoolStats } from '../data/siteData';
import { useTranslation } from '../hooks/useTranslation';

export default function About() {
  const { getText, t } = useTranslation();

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('about.pageTitle')}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            {t('about.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* History Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-4">
                {t('about.ourStory')}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
                {t('about.legacyOfExcellence')} {schoolInfo.established}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                {getText(aboutContent.history)}
              </p>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600"
                alt="School building"
                className="rounded-2xl shadow-xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-orange-500 text-white p-6 rounded-xl shadow-lg">
                <div className="text-4xl font-bold">{new Date().getFullYear() - schoolInfo.established}+</div>
                <div className="text-sm">{t('about.yearsOfExcellence')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardBody className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg mr-4">
                    <Target className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('about.ourMission')}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {getText(aboutContent.mission)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg mr-4">
                    <Eye className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('about.ourVision')}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {getText(aboutContent.vision)}
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium rounded-full mb-4">
              {t('about.ourValues')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              {t('about.whatWeStandFor')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aboutContent.values.map((value, index) => {
              const icons = [Star, Heart, Users, Award];
              const Icon = icons[index];
              const colors = ['blue', 'red', 'green', 'orange'];
              const color = colors[index];
              return (
                <Card key={index}>
                  <CardBody className="text-center p-6">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-${color}-100 dark:bg-${color}-900 mb-4`}>
                      <Icon className={`w-7 h-7 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {getText(value.title)}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {getText(value.description)}
                    </p>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Principal's Message */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-1">
              <div className="sticky top-28">
                <img
                  src={aboutContent.principalMessage.image}
                  alt={getText(aboutContent.principalMessage.name)}
                  className="w-full max-w-xs mx-auto rounded-2xl shadow-xl"
                />
                <div className="text-center mt-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {getText(aboutContent.principalMessage.name)}
                  </h3>
                  <p className="text-blue-600 dark:text-blue-400 font-medium">
                    {getText(aboutContent.principalMessage.title)}
                  </p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-4">
                {t('about.principalMessage')}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
                {t('about.wordFromPrincipal')}
              </h2>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {getText(aboutContent.principalMessage.message)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-blue-600 dark:bg-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {schoolStats.map((stat) => (
              <div key={stat.id} className="text-center">
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
    </>
  );
}
