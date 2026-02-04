import GalleryGrid from '../components/gallery/GalleryGrid';

export default function Gallery() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Photo Gallery
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Explore moments of learning, celebration, and growth at S.N.S. Shiksha Niketan.
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
