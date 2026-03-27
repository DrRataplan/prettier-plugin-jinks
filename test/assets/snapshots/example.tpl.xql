xquery version "3.0";

import module namespace config = "http://www.tei-c.org/tei-simple/config" at "modules/config.xqm";

declare variable $exist:path external;

declare variable $exist:root external;[# Use the first non-empty value from the defaults #]
declare variable $landingPage := "[[ head(
  ($context?defaults?landing, $context?defaults?browse, "browse.html")
) ]]";

if ($exist:path eq "") then
  <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
    <redirect url="{ request:get-uri() }/" />
  </dispatch>

else if ($exist:path eq "/") then
  <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
    <redirect url="{ $landingPage }" />
  </dispatch>
[% for $module in $context?api?* %]
else if ($exist:path eq "/[[ $module?prefix ]]/api.html") then
  <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
    <forward url="{ $exist:controller }/templates/[[ $module?prefix ]].html" />
  </dispatch>
[% endfor %]
else
[% if $context?dba %]
  let $main := "api-dba.xql"
[% else %]
  let $main := "api.xql"
[% endif %]
  return <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
    <forward url="{ $exist:controller }/modules/{ $main }" />
  </dispatch>