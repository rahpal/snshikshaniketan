import { Link } from 'react-router-dom';
import { GraduationCap, MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { schoolInfo, navLinks, socialLinks } from '../../data/siteData';

const iconMap = {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* School Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{schoolInfo.name}</h3>
            </div>
            <p className="text-sm text-slate-400">
              {schoolInfo.tagline}
            </p>
            <div className="flex space-x-3">
              {socialLinks.map((social) => {
                const Icon = iconMap[social.icon];
                return (
                  <a
                    key={social.name}
                    href={social.url}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-blue-600 transition-colors duration-300"
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-slate-400 hover:text-white transition-colors duration-300"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{schoolInfo.address}</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-sm">{schoolInfo.phone}</span>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-sm">{schoolInfo.email}</span>
              </li>
            </ul>
          </div>

          {/* Timing */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">School Hours</h4>
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{schoolInfo.timing}</span>
            </div>
            <div className="mt-4 p-4 bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-400">
                Admissions Open for {currentYear}-{currentYear + 1}
              </p>
              <Link
                to="/admissions"
                className="inline-block mt-2 text-blue-400 hover:text-blue-300 font-medium text-sm"
              >
                Apply Now →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
          <p>© {currentYear} {schoolInfo.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
