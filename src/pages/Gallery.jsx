import GalleryGrid from '../components/gallery/GalleryGrid';
import { useTranslation } from '../hooks/useTranslation';

export default function Gallery() {
  const { t } = useTranslation();

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('gallery.pageTitle')}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            {t('gallery.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <GalleryGrid />
        </div>
      </section>
    </>
  );
}
