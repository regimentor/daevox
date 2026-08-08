import classNames from "classnames";
import styles from "./header.module.css";

type NavItem = {
  label: string;
  href: string;
  current?: boolean;
};

type HeaderProps = {
  navItems?: readonly NavItem[];
};

const defaultNavItems: readonly NavItem[] = [
  { label: "Chats", href: "#/", current: true },
];

const Header = ({ navItems = defaultNavItems }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <nav
        aria-label="Main navigation"
        className={styles.navigation}
      >
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={classNames(styles.link, item.current && styles.linkCurrent)}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
};

export { Header };
export type { HeaderProps, NavItem };
