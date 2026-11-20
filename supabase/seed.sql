-- Reference data for KNOT. Safe to run more than once.

insert into public.institutions (name, email_domain)
values ('IIT Gandhinagar', 'iitgn.ac.in')
on conflict (email_domain) do nothing;

-- Shared office, club, committee and event addresses that must not sign up.
-- Patterns use SQL LIKE syntax against the part before the @.
insert into public.blocked_email_patterns (institution_id, pattern, note)
select i.id, p.pattern, p.note
from public.institutions i
cross join (values
  ('dean%', 'Dean offices'),
  ('registrar%', 'Registrar office'),
  ('director%', 'Director office'),
  ('office%', 'Generic offices'),
  ('admin%', 'Administration'),
  ('hod%', 'Heads of department'),
  ('secy%', 'Secretaries'),
  ('secretary%', 'Secretaries'),
  ('council%', 'Student councils'),
  ('club%', 'Clubs'),
  ('fest%', 'Festivals'),
  ('noreply%', 'System senders'),
  ('no-reply%', 'System senders'),
  ('helpdesk%', 'Help desks'),
  ('info', 'Generic info'),
  ('caa', 'Shared address'),
  ('cdsteam', 'Shared address'),
  ('hostel%', 'Hostel offices'),
  ('placement%', 'Placement office'),
  ('library%', 'Library')
) as p(pattern, note)
where i.email_domain = 'iitgn.ac.in'
on conflict (institution_id, pattern) do nothing;

insert into public.interests (name) values
  ('AI / ML'), ('Robotics'), ('Startups'), ('Hackathons'), ('Web dev'), ('Design'),
  ('Research'), ('Quizzing'), ('Debate'), ('Music'), ('Dance'), ('Theatre'),
  ('Photography'), ('Film'), ('Reading'), ('Writing'), ('Football'), ('Cricket'),
  ('Badminton'), ('Basketball'), ('Running'), ('Gym'), ('Chess'), ('Board games'),
  ('Video games'), ('Anime'), ('Cooking'), ('Travel'), ('Volunteering'), ('Late-night chai')
on conflict (name) do nothing;

-- Subdomains whose addresses also belong to IITGN students.
update public.institutions
set extra_domains = array['caa.iitgn.ac.in']
where email_domain = 'iitgn.ac.in';
