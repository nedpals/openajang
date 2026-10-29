#!/usr/bin/env python3
"""Local OpenAjang validator, bounded discovery helper and output adapters.
No network fetches. This is not an SSRF-safe production URL resolver.
"""
import argparse, copy, datetime as dt, json, re, sys
from decimal import Decimal
from email.headerregistry import Address
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import jsonschema, pycountry
from rfc3986_validator import validate_rfc3986
from langcodes.tag_parser import parse_tag

ROOT=Path(__file__).resolve().parents[1]
MEDIA='application/vnd.openajang+json'
DATE_RE=re.compile(r'^\d{4}-\d{2}-\d{2}$')
STAMP_RE=re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$')
class Invalid(ValueError):pass

def parse_stamp(value):
    m=STAMP_RE.fullmatch(value)
    if not m or m[3]=='-00:00':raise Invalid('Expected known-offset date-time')
    if m[3]!='Z' and (int(m[3][1:3])>23 or int(m[3][4:])>59):raise Invalid('Invalid offset')
    base=dt.datetime.fromisoformat(m[1]+('+00:00' if m[3]=='Z' else m[3]))
    return Decimal(int(base.timestamp()))+Decimal(m[2] or '0')

def parse_date(value):
    if not DATE_RE.fullmatch(value):raise Invalid('Expected full-date')
    return dt.date.fromisoformat(value)

def uri_ok(value):
    return validate_rfc3986(value,rule='URI') is not None

def url_ok(value):
    if not uri_ok(value) or '\\' in value:return False
    try:
        p=urlsplit(value)
        return p.scheme.lower() in ('http','https') and bool(p.hostname) and p.username is None and p.password is None and (p.port is None or 0<p.port<65536)
    except ValueError:return False

def email_ok(value):
    try:
        a=Address(addr_spec=value)
        return bool(a.username and a.domain) and not re.search(r'[\r\n]',value)
    except (ValueError,TypeError):return False

def language_ok(value):
    try:parse_tag(value);return True
    except (ValueError,TypeError):return False

def zone_ok(value):
    try:ZoneInfo(value);return True
    except (ZoneInfoNotFoundError,ValueError):return False

CHECKER=jsonschema.FormatChecker()
for name,fn in {'oa-url':url_ok,'oa-uri':uri_ok,'oa-email':email_ok,'oa-language':language_ok,'oa-zone':zone_ok,'oa-country':lambda s:pycountry.countries.get(alpha_2=s) is not None,'oa-currency':lambda s:pycountry.currencies.get(alpha_3=s) is not None,'oa-date':lambda s:bool(parse_date(s)),'oa-date-time':lambda s:parse_stamp(s) is not None}.items():
    CHECKER.checks(name,raises=(ValueError,TypeError,OverflowError))(fn)
SCHEMA=json.loads((ROOT/'schema/event.json').read_text())
SCHEMA_URL=SCHEMA['$id']
jsonschema.Draft202012Validator.check_schema(SCHEMA)
VALIDATOR=jsonschema.Draft202012Validator(SCHEMA,format_checker=CHECKER)

def unicode_check(value):
    if isinstance(value,str):
        if any(0xd800<=ord(c)<=0xdfff for c in value):raise Invalid('Unpaired Unicode surrogate')
    elif isinstance(value,dict):
        for k,v in value.items():unicode_check(k);unicode_check(v)
    elif isinstance(value,list):
        for v in value:unicode_check(v)

def pairs(items):
    out={}
    for k,v in items:
        if k in out:raise Invalid('Duplicate JSON property: '+k)
        out[k]=v
    return out

def loads(text):
    return json.loads(text,object_pairs_hook=pairs,parse_constant=lambda s:(_ for _ in ()).throw(Invalid('Invalid JSON constant '+s)))

def validate(d):
    unicode_check(d)
    errors=sorted(VALIDATOR.iter_errors(d),key=lambda e:'/'.join(map(str,e.path)))
    if errors:raise Invalid('; '.join('/'+ '/'.join(map(str,e.path))+': '+e.message for e in errors))
    date_only=bool(DATE_RE.fullmatch(d['starts_at']))
    start=parse_date(d['starts_at']) if date_only else parse_stamp(d['starts_at'])
    if 'ends_at' in d:
        end=parse_date(d['ends_at']) if date_only else parse_stamp(d['ends_at'])
        if (end<start if date_only else end<=start):raise Invalid('Event end does not follow start')
    for obj,a,b in [(d.get('registration',{}),'opens_at','closes_at')]+[(t,'sales_start','sales_end') for t in d.get('tickets',[])]:
        if a in obj and b in obj and parse_stamp(obj[b])<=parse_stamp(obj[a]):raise Invalid(b+' must follow '+a)
    for old in d.get('previous_starts_at',[]):
        old_is_date=bool(DATE_RE.fullmatch(old))
        if old_is_date==date_only:
            earlier=parse_date(old) if old_is_date else parse_stamp(old)
            if earlier==start:raise Invalid('History contains current start')
    ticket_ids=[x['id'] for x in d.get('tickets',[])]
    if len(set(ticket_ids))!=len(ticket_ids):raise Invalid('Duplicate ticket IDs')
    tags=[s.casefold() for s in d.get('tags',[])]
    if len(set(tags))!=len(tags):raise Invalid('Duplicate tags after case folding')
    p=d['location'].get('physical',{})
    if p.get('name','').strip().casefold() in ('tba','tbd','to be announced'):raise Invalid('Use physical.status, not a placeholder venue')
    return d

def event_id(d):return d.get('id',d['url'])

def utc_string(value,local=False):
    # Validate before datetime conversion; preserve input precision up to microseconds.
    parse_stamp(value)
    m=STAMP_RE.fullmatch(value)
    if m[2] and len(m[2])-1>6:raise Invalid('Adapter declines precision beyond six fractional digits')
    v=dt.datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(dt.timezone.utc)
    return v.isoformat().replace('+00:00','' if local else 'Z')

def schema_org(d):
    validate(d)
    notes=[]
    out={'@context':'https://schema.org','@type':'Event','@id':event_id(d),'url':d['url'],'name':d['title'],'startDate':d['starts_at']}
    for src,dst in [('ends_at','endDate'),('same_as','sameAs'),('previous_starts_at','previousStartDate')]:
        if src in d:out[dst]=copy.deepcopy(d[src])
    if 'description' in d or 'summary' in d:out['description']=d.get('description',d.get('summary'))
    statuses={'scheduled':'EventScheduled','postponed':'EventPostponed','rescheduled':'EventRescheduled','cancelled':'EventCancelled'}
    if d['status'] in statuses:out['eventStatus']='https://schema.org/'+statuses[d['status']]
    else:notes.append('completed has no exact Schema.org eventStatus mapping; omitted')
    modes={'physical':'OfflineEventAttendanceMode','virtual':'OnlineEventAttendanceMode','hybrid':'MixedEventAttendanceMode'}
    out['eventAttendanceMode']='https://schema.org/'+modes[d['location']['type']]
    # The source party has no kind field. Do not invent Person/Organization type.
    party=lambda p:{({'id':'@id','phone':'telephone'}.get(k,k)):v for k,v in p.items() if k in ('name','id','url','email','phone')}
    out['organizer']=party(d['organizer'])
    loc=[]
    if 'physical' in d['location']:
        p=d['location']['physical']; place={'@type':'Place'}
        for k in ('name','url','instructions'):
            if k in p:place['description' if k=='instructions' else k]=p[k]
        if 'id' in p:place['@id']=p['id']
        if 'address' in p:
            fields={'street':'streetAddress','locality':'addressLocality','region':'addressRegion','postal_code':'postalCode','country':'addressCountry'}
            place['address']={'@type':'PostalAddress',**{fields[k]:v for k,v in p['address'].items() if k in fields}}
        if 'coordinates' in p:place['geo']={'@type':'GeoCoordinates',**{k:p['coordinates'][k] for k in ('latitude','longitude')}}
        if p.get('status','confirmed')!='confirmed':notes.append('Physical venue certainty not preserved structurally')
        loc.append(place)
    if 'virtual' in d['location']:
        v=d['location']['virtual']; item={'@type':'VirtualLocation','url':v['url']}
        if 'instructions' in v:item['description']=v['instructions']
        loc.append(item)
    out['location']=loc[0] if len(loc)==1 else loc
    if 'image' in d:out['image']=d['image']['url']
    if 'tags' in d:out['keywords']=d['tags']
    offers=[]
    avail={'available':'InStock','limited':'LimitedAvailability','sold_out':'SoldOut','unavailable':'OutOfStock'}
    for t in d.get('tickets',[]):
        offer={'@type':'Offer','identifier':t['id'],'name':t['name']}
        for k in ('description','url'):
            if k in t:offer[k]=t[k]
        if 'price' in t:offer.update(price=t['price']['amount'],priceCurrency=t['price']['currency'])
        if t.get('availability') in avail:offer['availability']='https://schema.org/'+avail[t['availability']]
        if 'seller' in t:offer['seller']=party(t['seller'])
        for a,b in [('sales_start','validFrom'),('sales_end','validThrough')]:
            if a in t:offer[b]=t[a]
        offers.append(offer)
    if offers:out['offers']=offers
    reg=d.get('registration',{})
    active=d['status'] not in ('cancelled','postponed','completed')
    if reg.get('url') and active and reg.get('status','unknown') not in ('closed','not_yet_open'):
        out['potentialAction']={'@type':'Action','identifier':'registration','name':{'open':'Register','waitlist':'Join waitlist'}.get(reg.get('status'),'View registration'),'target':reg['url']}
    if reg:notes.append('Registration required/state are not preserved as native structured fields; action is an adapter convention')
    if DATE_RE.fullmatch(d['starts_at']):notes.append('Date-only range retains unpublished hours; target display semantics may vary')
    if 'time_zone' in d:notes.append('Separate civil time_zone omitted; encoded dates/offsets retained')
    if 'status_note' in d:
        out['description']='\n\n'.join(filter(None,[out.get('description'),d['status_note']]))
    for k in ('publisher','series','extensions'):
        if k in d:notes.append(k+' omitted from structured mapping')
    notes.append('Source updated_at has no selected native Event mapping; omitted')
    notes.append('Party kind unspecified; no Person/Organization type inferred')
    if 'language' in d:notes.append('Document language is not assumed to be spoken event language; omitted')
    return out,notes

def jscalendar(d):
    validate(d)
    if DATE_RE.fullmatch(d['starts_at']):return None,['Declined: clock times unpublished; no invented midnight or all-day event']
    if d['status']=='postponed':return None,['Declined: postponed start is not active confirmed attendance']
    if 'ends_at' not in d:return None,['Declined: unknown end cannot be preserved by JSCalendar default zero duration']
    try:
        start=utc_string(d['starts_at'],local=True);updated=utc_string(d['updated_at'])
        if 'ends_at' in d:utc_string(d['ends_at'])
    except Invalid as e:return None,['Declined: '+str(e)]
    out={'@type':'Event','uid':event_id(d),'title':d['title'],'start':start,'timeZone':'Etc/UTC','updated':updated,'status':'cancelled' if d['status']=='cancelled' else 'confirmed'}
    notes=[]
    seconds=parse_stamp(d['ends_at'])-parse_stamp(d['starts_at'])
    out['duration']='PT'+format(seconds,'f')+'S'
    description=[d.get('description',d.get('summary','')),'Organizer: '+d['organizer']['name'],'Source: '+d['url']]
    if 'status_note' in d:description.append(d['status_note'])
    if d['status'] in ('rescheduled','completed'):
        description.append('OpenAjang status: '+d['status']);notes.append('Lifecycle mapped to confirmed; original status preserved descriptively')
    links={'event':{'@type':'Link','href':d['url'],'title':'Event page'}}
    if 'url' in d['organizer']:links['organizer']={'@type':'Link','href':d['organizer']['url'],'title':d['organizer']['name']}
    if 'physical' in d['location']:
        p=d['location']['physical'];loc={'@type':'Location'}
        if 'name' in p:loc['name']=p['name']
        parts=[p.get('instructions',''),' '.join(p.get('address',{}).values())]
        if p.get('status','confirmed')!='confirmed':parts.append('Venue status: '+p['status']);notes.append('Venue certainty preserved descriptively only')
        if any(parts):loc['description']='\n'.join(filter(None,parts))
        if 'coordinates' in p:loc['coordinates']='geo:'+str(p['coordinates']['latitude'])+','+str(p['coordinates']['longitude'])
        out['locations']={'venue':loc}
    if 'virtual' in d['location']:
        v=d['location']['virtual'];out['virtualLocations']={'online':{'@type':'VirtualLocation','uri':v['url'],'name':v.get('platform','Online attendance'),'description':'Public attendance/access-information page. '+v.get('instructions','')}}
    reg=d.get('registration',{})
    if reg:
        description.append('Registration: '+reg.get('status','unknown')+'. '+reg.get('instructions',''))
        if reg.get('url') and d['status'] not in ('cancelled','postponed','completed') and reg.get('status','unknown') not in ('closed','not_yet_open'):
            links['registration']={'@type':'Link','href':reg['url'],'title':{'open':'Register','waitlist':'Join waitlist'}.get(reg.get('status'),'View registration')}
        notes.append('Registration semantics retained descriptively; link key is an adapter convention')
    for i,t in enumerate(d.get('tickets',[])):
        description.append(t['name']+': '+t.get('description','')+((' Price '+t['price']['amount']+' '+t['price']['currency']) if 'price' in t else ' Price not published.')+' Availability: '+t.get('availability','unknown'))
        if t.get('url') and d['status'] not in ('cancelled','postponed','completed') and t.get('availability','unknown') not in ('sold_out','unavailable'):
            links['ticket'+str(i)]={'@type':'Link','href':t['url'],'title':t['name']}
    if d.get('tickets'):notes.append('Ticket prices/availability/coverage have no native mapping here; descriptive text and links only; seller omitted')
    out['links']=links;out['description']='\n\n'.join(filter(None,description))
    notes.append('Organizer retained descriptively; no calendar ownership or invitation role inferred')
    for k in ('time_zone','previous_starts_at','publisher','series','extensions','image','tags','same_as','language'):
        if k in d:notes.append(k+' not preserved structurally')
    return out,notes

class HeadLinks(HTMLParser):
    def __init__(self):super().__init__();self.in_head=False;self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='head':self.in_head=True
        if tag=='body':self.in_head=False
        if tag=='link' and self.in_head:self.links.append(dict(attrs))
    def handle_endtag(self,tag):
        if tag=='head':self.in_head=False

def remove_dots(path):
    inp=path;out=''
    while inp:
        if inp.startswith('../'):inp=inp[3:]
        elif inp.startswith('./'):inp=inp[2:]
        elif inp.startswith('/./'):inp=inp[2:]
        elif inp=='/.':inp='/'
        elif inp.startswith('/../'):inp=inp[3:];out=out.rsplit('/',1)[0]
        elif inp=='/..':inp='/';out=out.rsplit('/',1)[0]
        elif inp in ('.','..'):inp=''
        else:
            cut=inp.find('/',1 if inp.startswith('/') else 0)
            if cut<0:out+=inp;inp=''
            else:out+=inp[:cut];inp=inp[cut:]
    return out

def normalize_url(url):
    if not url_ok(url):raise Invalid('Invalid discovery URL')
    p=urlsplit(url);host=p.hostname.lower();host='['+host+']' if ':' in host else host
    port=p.port
    if port and not (p.scheme.lower()=='https' and port==443 or p.scheme.lower()=='http' and port==80):host+=':'+str(port)
    return urlunsplit((p.scheme.lower(),host,remove_dots(p.path) or '/',p.query,''))

def discover(html,final_url):
    if len(html.encode('utf-8'))>1048576:raise Invalid('HTML discovery input exceeds local 1 MiB bound')
    parser=HeadLinks();parser.feed(html)
    candidates=set()
    for a in parser.links:
        if 'alternate' in a.get('rel','').lower().split() and a.get('type','').split(';')[0].strip().lower()==MEDIA and a.get('href'):
            candidates.add(normalize_url(urljoin(final_url,a['href'])))
    if len(candidates)>1:raise Invalid('Ambiguous OpenAjang links')
    return next(iter(candidates),None)

def refresh_decision(code,old,new=None,source_continuity=True):
    if code==304:return 'retain'
    if code==200:
        try:validate(new)
        except (Invalid,TypeError):return 'retain-invalid'
        if event_id(old)!=event_id(new):return 'identity-conflict'
        return 'replace' if source_continuity else 'unverified-source-conflict'
    if code==404:return 'rediscover-before-removal'
    if code==410:return 'document-removed-not-cancelled'
    return 'retain-and-backoff'

def registration_action(d):
    """Core lifecycle/state policy only; caller separately evaluates pastness/freshness."""
    if d['status'] in ('cancelled','postponed','completed'):return None
    reg=d.get('registration',{})
    if not reg.get('url') or reg.get('status','unknown') in ('closed','not_yet_open'):return None
    return {'label':{'open':'Register','waitlist':'Join waitlist'}.get(reg.get('status'),'View registration'),'url':reg['url']}

def generate():
    folder=ROOT/'generated';folder.mkdir(exist_ok=True)
    diagnostics={}
    for path in sorted((ROOT/'examples').glob('*.openajang.json')):
        d=validate(loads(path.read_text()));stem=path.name.removesuffix('.openajang.json')
        s,snotes=schema_org(d);j,jnotes=jscalendar(d)
        (folder/(stem+'.schemaorg.json')).write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
        jp=folder/(stem+'.jscalendar.json')
        if j is None:jp.unlink(missing_ok=True)
        else:jp.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
        diagnostics[stem]={'schema_org':{'generated':True,'diagnostics':snotes},'jscalendar':{'generated':j is not None,'diagnostics':jnotes}}
    (folder/'conversion-diagnostics.json').write_text(json.dumps(diagnostics,indent=2)+'\n')
    print(json.dumps({'validated_examples':len(diagnostics),'schema_org_outputs':len(diagnostics),'jscalendar_outputs':sum(x['jscalendar']['generated'] for x in diagnostics.values())}))

def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['validate','generate']);p.add_argument('files',nargs='*');a=p.parse_args()
    if a.command=='generate':generate();return
    failed=False
    for name in a.files:
        try:validate(loads(Path(name).read_text(encoding='utf-8')));print('PASS '+name)
        except (Invalid,ValueError,UnicodeError) as e:failed=True;print('FAIL '+name+': '+str(e),file=sys.stderr)
    if not a.files:p.error('validate requires one or more files')
    if failed:sys.exit(1)
if __name__=='__main__':main()
