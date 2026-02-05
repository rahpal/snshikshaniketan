import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import ContactForm from '../components/forms/ContactForm';
import { schoolInfo } from '../data/siteData';
import { useTranslation } from '../hooks/useTranslation';

export default function Contact() {
  const { getText, t } = useTranslation();

  const contactDetails = [
    {
      icon: MapPin,
      title: t('contact.visitUs'),
      content: getText(schoolInfo.address),
      color: 'blue',
    },
    {
      icon: Phone,
      title: t('forms.phoneNumber'),
      content: schoolInfo.phone,
      color: 'green',
    },
    {
      icon: Mail,
      title: t('forms.emailAddress'),
      content: schoolInfo.email,
      color: 'orange',
    },
    {
      icon: Clock,
      title: t('common.schoolHours'),
      content: getText(schoolInfo.timing),
      color: 'purple',
    },
  ];

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('contact.pageTitle')}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            {t('contact.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactDetails.map((detail, index) => {
              const Icon = detail.icon;
              return (
                <Card key={index}>
                  <CardBody className="text-center p-6">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-${detail.color}-100 dark:bg-${detail.color}-900 mb-4`}>
                      <Icon className={`w-7 h-7 text-${detail.color}-600 dark:text-${detail.color}-400`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {detail.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {detail.content}
                    </p>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {/* Contact Form & Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-4">
                {t('contact.sendUsMessage')}
              </span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                {t('contact.getInTouch')}
              </h2>
              <Card>
                <CardBody className="p-8">
                  <ContactForm />
                </CardBody>
              </Card>
            </div>

            {/* Map Placeholder */}
            <div>
              <span className="inline-block px-4 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium rounded-full mb-4">
                {t('contact.visitUs')}
              </span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                {t('contact.visitUs')}
              </h2>
              <Card className="h-[400px] lg:h-[calc(100%-80px)]">
                <CardBody className="p-0 h-full">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3571.8!2d80.7183631!3d26.6033607!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x399c0fe60815f3c9%3A0xee71d0f8e611adfe!2sS.N.%20Shiksha%20Niketan!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                    width="100%"
                    height="100%"
                    style={{ border: 0, borderRadius: '0.75rem' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={t('contact.mapTitle')}
                  />
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
            {t('forms.scheduleVisit')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
            {t('contact.messageSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={`tel:${schoolInfo.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Phone className="w-5 h-5 mr-2" />
              {t('forms.phoneNumber')}
            </a>
            <a
              href={`mailto:${schoolInfo.email}`}
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 hover:bg-blue-600 hover:text-white font-semibold rounded-lg transition-colors"
            >
              <Mail className="w-5 h-5 mr-2" />
              {t('forms.emailAddress')}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
