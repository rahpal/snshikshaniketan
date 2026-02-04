import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import { useTranslation } from '../../hooks/useTranslation';

export default function AdmissionInquiryForm() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    parentName: '',
    email: '',
    phone: '',
    childName: '',
    childAge: '',
    classApplying: '',
    currentSchool: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Admission inquiry submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        parentName: '',
        email: '',
        phone: '',
        childName: '',
        childAge: '',
        classApplying: '',
        currentSchool: '',
        message: '',
      });
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          {t('forms.inquirySubmitted')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          {t('forms.thankYouInterest')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.parentGuardianName')} *
          </label>
          <input
            type="text"
            id="parentName"
            name="parentName"
            value={formData.parentName}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={t('forms.parentFullName')}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.emailAddress')} *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={t('forms.yourEmail')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.phoneNumber')} *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="+91 XXXXX XXXXX"
          />
        </div>
        <div>
          <label htmlFor="childName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.childName')} *
          </label>
          <input
            type="text"
            id="childName"
            name="childName"
            value={formData.childName}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={t('forms.childFullName')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="childAge" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.childAge')} *
          </label>
          <input
            type="number"
            id="childAge"
            name="childAge"
            value={formData.childAge}
            onChange={handleChange}
            required
            min="4"
            max="12"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={t('forms.ageInYears')}
          />
        </div>
        <div>
          <label htmlFor="classApplying" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.classApplyingFor')} *
          </label>
          <select
            id="classApplying"
            name="classApplying"
            value={formData.classApplying}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">{t('forms.selectClass')}</option>
            <option value="1">Class 1</option>
            <option value="2">Class 2</option>
            <option value="3">Class 3</option>
            <option value="4">Class 4</option>
            <option value="5">Class 5</option>
          </select>
        </div>
        <div>
          <label htmlFor="currentSchool" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('forms.currentSchool')}
          </label>
          <input
            type="text"
            id="currentSchool"
            name="currentSchool"
            value={formData.currentSchool}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={t('forms.ifApplicable')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('forms.additionalInfo')}
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          placeholder={t('forms.anyQuestions')}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full md:w-auto">
        {t('common.submitInquiry')}
        <Send className="w-5 h-5 ml-2" />
      </Button>
    </form>
  );
}
