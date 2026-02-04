import { useState } from 'react';
import { galleryCategories, galleryImages } from '../../data/siteData';
import { useTranslation } from '../../hooks/useTranslation';
import ImageModal from './ImageModal';

export default function GalleryGrid() {
  const { getText } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedImage, setSelectedImage] = useState(null);

  const filteredImages = activeCategory === 'All'
    ? galleryImages
    : galleryImages.filter(img => img.category === activeCategory);

  return (
    <div>
      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {galleryCategories.map((category, index) => {
          const categoryKey = category.en;
          return (
            <button
              key={index}
              onClick={() => setActiveCategory(categoryKey)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === categoryKey
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {getText(category)}
            </button>
          );
        })}
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredImages.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image.src}
              alt={getText(image.title)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded mb-2">
                  {image.category}
                </span>
                <h3 className="text-white font-semibold">{getText(image.title)}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
