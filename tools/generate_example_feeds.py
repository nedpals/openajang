"""Regenerate illustrative fixture feeds; not a live publishing service."""
import json,xml.etree.ElementTree as E
from pathlib import Path
R=Path(__file__).resolve().parents[1];A='http://www.w3.org/2005/Atom';E.register_namespace('',A)
S='2026-10-29T09:00:00Z'
def el(parent,name,text=None,**attrs):
 x=E.SubElement(parent,name,attrs)
 if text is not None:x.text=text
 return x
feed=E.Element('{'+A+'}feed')
el(feed,'{'+A+'}id','https://directory.example.org/feeds/examples');el(feed,'{'+A+'}title','OpenAjang example snapshots');el(feed,'{'+A+'}updated',S)
author=el(feed,'{'+A+'}author');el(author,'{'+A+'}name','Example fixture publisher')
el(feed,'{'+A+'}link',rel='self',type='application/atom+xml',href='https://directory.example.org/feeds/examples.atom')
el(feed,'{'+A+'}link',rel='alternate',type='text/html',href='https://directory.example.org/examples')
rows=[]
for p in sorted((R/'examples').glob('*.openajang.json')):
 d=json.loads(p.read_text());doc='https://directory.example.org/examples/'+p.name
 summary='Example snapshot, not a current verified listing. '+d['starts_at']+(' through '+d['ends_at'] if 'ends_at' in d else '')+'. '+d.get('summary',d['title'])+' Status: '+d['status']+'. Registration: '+d.get('registration',{}).get('status','not specified')+'.'
 en=el(feed,'{'+A+'}entry');el(en,'{'+A+'}id',d['id']);el(en,'{'+A+'}title',d['title']);el(en,'{'+A+'}published',S);el(en,'{'+A+'}updated',S)
 el(en,'{'+A+'}link',rel='alternate',type='text/html',href=d['url']);el(en,'{'+A+'}link',rel='alternate',type='application/vnd.openajang+json',href=doc);el(en,'{'+A+'}summary',summary,type='text');rows.append((d,doc,summary))
E.indent(feed);E.ElementTree(feed).write(R/'examples/directory.atom',encoding='utf-8',xml_declaration=True)
# Use atom prefix for the RSS extension, with unnamespaced RSS core elements.
E.register_namespace('atom',A)
rss=E.Element('rss',{'version':'2.0'});channel=el(rss,'channel');el(channel,'title','OpenAjang example snapshots');el(channel,'link','https://directory.example.org/examples');el(channel,'description','Illustrative event snapshots, not current verified listings.');el(channel,'lastBuildDate','Thu, 29 Oct 2026 09:00:00 GMT')
el(channel,'{'+A+'}link',rel='self',type='application/rss+xml',href='https://directory.example.org/feeds/examples.rss')
for d,doc,summary in rows:
 item=el(channel,'item');el(item,'guid',d['id'],isPermaLink='false');el(item,'title',d['title']);el(item,'link',d['url']);el(item,'pubDate','Thu, 29 Oct 2026 09:00:00 GMT');el(item,'description',summary);el(item,'{'+A+'}link',rel='alternate',type='application/vnd.openajang+json',href=doc)
E.indent(rss);E.ElementTree(rss).write(R/'examples/directory.rss',encoding='utf-8',xml_declaration=True)
