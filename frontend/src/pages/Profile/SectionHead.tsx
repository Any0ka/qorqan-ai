import styles from './Profile.module.css';

/** Heading + intro shared by every section. The heading takes focus when the section changes. */
export function SectionHead({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className={styles.sectionHead}>
      <h2 id="profile-section-title" tabIndex={-1} className={styles.sectionTitle}>
        {title}
      </h2>
      {intro && <p className={styles.sectionIntro}>{intro}</p>}
    </div>
  );
}
