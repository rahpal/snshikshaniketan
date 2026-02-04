import { ClipboardList, FileText, Users, CheckCircle } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import AdmissionInquiryForm from '../components/forms/AdmissionInquiryForm';
import { admissionInfo } from '../data/siteData';

export default function Admissions() {
  const stepIcons = [ClipboardList, FileText, Users, CheckCircle];

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Admissions
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Begin your child's journey with us. Learn about our admission process and requirements.
          </p>
        </div>
      </section>

      {/* Admission Process */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-4">
              How To Apply
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Admission Process
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our simple 4-step admission process makes it easy to enroll your child.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {admissionInfo.process.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <div key={step.step} className="relative">
                  <Card>
                    <CardBody className="text-center p-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4">
                        <Icon className="w-8 h-8" />
                      </div>
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {step.step}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {step.description}
                      </p>
                    </CardBody>
                  </Card>
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-blue-200 dark:bg-blue-800" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Age Requirements & Documents */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Age Requirements */}
            <Card>
              <CardBody className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                  Age Requirements
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Children must meet the following age criteria as of March 31st of the admission year:
                </p>
                <div className="space-y-3">
                  {admissionInfo.ageRequirements.map((req) => (
                    <div
                      key={req.class}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                    >
                      <span className="font-medium text-slate-900 dark:text-white">
                        {req.class}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {req.age}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Required Documents */}
            <Card>
              <CardBody className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                  Required Documents
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Please keep the following documents ready for the admission process:
                </p>
                <ul className="space-y-3">
                  {admissionInfo.documents.map((doc, index) => (
                    <li
                      key={index}
                      className="flex items-center text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Fee Structure */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium rounded-full mb-4">
              Fee Structure
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Transparent Fee Information
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Card>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="text-left px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          Fee Type
                        </th>
                        <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          Amount
                        </th>
                        <th className="text-left px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {admissionInfo.fees.map((fee, index) => (
                        <tr
                          key={index}
                          className="border-t border-slate-200 dark:border-slate-700"
                        >
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                            {fee.item}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {fee.amount}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                            {fee.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
              * Fees are subject to revision. Please contact the school office for the latest information.
            </p>
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-sm font-medium rounded-full mb-4">
                Get Started
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Admission Inquiry
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Fill out the form below and our admissions team will get back to you.
              </p>
            </div>
            <Card>
              <CardBody className="p-8">
                <AdmissionInquiryForm />
              </CardBody>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
