export default function Card({ children, className = '', hover = true, ...props }) {
  return (
    <div
      className={`
        bg-white dark:bg-slate-800
        rounded-xl shadow-lg
        ${hover ? 'hover:shadow-xl hover:-translate-y-1' : ''}
        transition-all duration-300
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-6 pb-0 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}
