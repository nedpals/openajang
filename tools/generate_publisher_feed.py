"""Regenerate the illustrative publisher feeds; not a live publishing service."""
import json,xml.etree.ElementTree as E
from pathlib import Path
R=Path(__file__).resolve().parents[1];A='http://www.w3.org/2005/Atom';E.register_namespace('',A)
D=R/'examples/publisher';BASE='https://community.example.org/'
def el(parent,name,text=None,**attrs):
 x=E.SubElement(parent,'{'+A+'}'+name,attrs)
 if text is not None:x.text=text
 return x
def doc(name):return json.loads((D/(name+'.openajang.json')).read_text())
# Each row: slug, first published, entry updated, title, summary. Entry `updated`
# moves only when the publisher makes a significant change to that entry.
BEFORE=[
 ('build-night-2026-11','2026-10-20T09:00:00Z','2026-10-20T09:00:00Z','Community Build Night, November 2026','2026-11-14, 18:00 to 20:00 (+08:00). In person at Example Community Room, Davao City. Registration is open.'),
 ('hack-day-2026-12','2026-10-22T09:00:00Z','2026-10-22T09:00:00Z','Community Hack Day, December 2026','2026-12-05, 09:00 to 17:00 (+08:00). In person at Example Co-working Space, Davao City. Registration is open.'),
]
AFTER=[
 ('meetup-2027-01','2026-10-30T09:00:00Z','2026-10-30T09:00:00Z','Community Meetup, January 2027','2027-01-16, 18:30 to 21:00 (+08:00). In person at Example Hall, Davao City. No registration required.'),
 ('hack-day-2026-12','2026-10-22T09:00:00Z','2026-10-30T07:30:00Z','Cancelled: Community Hack Day, December 2026','Cancelled. Was planned for 2026-12-05 in person at Example Co-working Space, Davao City. Registration is closed.'),
 ('build-night-2026-11','2026-10-20T09:00:00Z','2026-10-28T10:00:00Z','Community Build Night, November 2026','2026-11-14, 18:00 to 20:00 (+08:00). Venue changed: now in person at Riverside Library Meeting Room, Davao City. Registration is open.'),
]
def write(path,rows,updated):
 feed=E.Element('{'+A+'}feed')
 el(feed,'id',BASE+'feeds/events');el(feed,'title','Example Community events');el(feed,'updated',updated)
 el(el(feed,'author'),'name','Example Community')
 el(feed,'link',rel='self',type='application/atom+xml',href=BASE+'events.atom')
 el(feed,'link',rel='alternate',type='text/html',href=BASE+'events')
 for slug,pub,upd,title,summary in rows:
  d=doc(slug);en=el(feed,'entry')
  el(en,'id',d['id']);el(en,'title',title);el(en,'published',pub);el(en,'updated',upd)
  el(en,'link',rel='alternate',type='text/html',href=d['url'])
  el(en,'link',rel='alternate',type='application/vnd.openajang+json',href=BASE+'events/'+slug+'.openajang.json')
  el(en,'summary',summary,type='text')
 E.indent(feed);E.ElementTree(feed).write(path,encoding='utf-8',xml_declaration=True)
write(D/'events-before.atom',BEFORE,'2026-10-22T09:00:00Z')
write(D/'events.atom',AFTER,'2026-10-30T09:00:00Z')
