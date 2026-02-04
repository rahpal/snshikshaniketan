import HeroCarousel from '../components/home/HeroCarousel';
import StatsSection from '../components/home/StatsSection';
import FeaturesSection from '../components/home/FeaturesSection';
import TestimonialsCarousel from '../components/home/TestimonialsCarousel';
import CTASection from '../components/home/CTASection';

export default function Home() {
  return (
    <>
      <HeroCarousel />
      <StatsSection />
      <FeaturesSection />
      <TestimonialsCarousel />
      <CTASection />
    </>
  );
}
