import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

export default function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Give Your Child the Best Start?
        </h2>
        <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
          Join our family of learners and give your child the foundation they deserve. Admissions are now open for the upcoming academic year.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button to="/admissions" variant="secondary" size="lg">
            Start Admission Process
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button to="/contact" size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
            Schedule a Visit
          </Button>
        </div>
      </div>
    </section>
  );
}
