const fhirpath = require('fhirpath');
const _ = require('underscore');
// embdedded function to inspect the results of fhir path calls to tell if something
// returned an object or 'true'.  This is used to wrap the filter/ignore/exclude
// functions to dtermin the truthyness of the fhir path calls
let isTrue = (arg) => {
  if (Array.isArray(arg) ){
    return arg.find(i => isTrue(i));
  } else if (typeof arg === 'object'){
    return !_.isEmpty(arg);
  } else if (typeof arg === 'string' && arg === 'false'){
    return false;
  }
  return arg;
};

// function to build the exec methods for FilterMappers.  The exec function modifies
// the resource.  If the value is a string it will try to require the function else {
// if it is a function it will simply pass back the value of the argument.

let buildProcessor = (arg) => {
  let processor = null;
  switch (typeof arg) {
    case 'string':
      processor = require(arg);
      break;
    case 'function':
      processor = arg;
      break;
  }
  return processor;
};

// build a filter for use in the filter/ingnore/exclude operations
// the filter may be a string or a function.  If it is a string it is treated as
// a fhirpath expression and a filtering function will be built around that expression.
// if it is a function then it will simply be returned.
let buildFilter = (arg) => {
  // if string create a filter out of it
  if (Array.isArray(arg)){
    let filters = arg.map( f => buildFilter(f));
    return (resource) => {return filters.find( filter => isTrue(filter(resource)));};
  }
  let filter = null;
  switch (typeof arg) {
    case 'string': {
      let path = fhirpath.compile(arg);
      filter = (resource) => isTrue(path(resource));
      break;}
    case 'function':{
      filter = arg;
      break;}
  }
  return filter;
};

// Build mappers from the arguments that are passed in.  If the args are null/undefined
// return an empty array.
// if the args are an array return an array of mappers
// if the args are an object that represent either an aggregate or filter mapper
// create one and return it
// if the args are a json object with string: object mappings treate the strings as
// potential filters and or descriptions of the mapper and return an aggregate or filter
// mapper depending on the rest of the attributes in the json object.
let buildMappers = (args) =>{
  if (!args) {return [];}
  // if the args are an array build an array of mappers to return
  if (Array.isArray(args)){
    return args.map(m => buildMappers(m));
  }
  // if the args are an object and it has a property called mappers
  // treat it like an aggregate mapper else like a filter mapper
  if (args.mappers){
    return new AggregateMapper(args);
  } else if (args.exec){
    return new FilterMapper(args);
  } else { // treat this like an object mapping of  {"filter" : {mapping attributes}}
    let mappers = [];
    for (var filter in args){
      let mapper = args[filter];
      if (typeof mapper === 'string'){
        mappers.push(require(mapper));
      } else if (typeof mapper === 'object' && !mapper.constructor.name === 'Object'){
        mappers.push(mapper);
      } else {
        if (!mapper.filter){ mapper.filter = filter;}
        if (!mapper.description){mapper.description = filter;}
        mappers.push(buildMappers(mapper));
      }
    }
    return mappers;
  }
};

// Class to contain other mappers in a heirachy.  In oder for the contained
// mappers to be executed they the filter would have to match for the containing
// mapper.  This class can contain other aggregate mappers.
class AggregateMapper {

  constructor(args){
    this.args = args;
    this.filterFn = buildFilter(args.filter);
    this.defaultFn = buildProcessor(args.default);
    this.ignoreFn = buildFilter(args.ignore);
    this.excludeFn = buildFilter(args.exclude);
    this.mappers = buildMappers(args.mappers);
  }

  // if an ignore filter was provided execute it on the resource otherwise
  // return false
  ignore(resource){
    return this.ignoreFn ? this.ignoreFn(resource) : false;
  }

  // if an exclude filter was provided execute it on the resource otherwise return false
  exclude(resource){
    return this.excludeFn ? this.excludeFn(resource) : false;
  }

  // if a default function was provided execute that function on the resource otherwise
  // return the resource as is
  default(resource){
    return this.defaultFn ? this.defaultFn(resource) : resource;
  }

  // if a filter was provided execute that on the resource otherwise
  // return false
  filter(resource){
    return (this.filterFn) ? this.filterFn(resource) : false;
  }

  // This method executes the aggregate filters.  There is a set order of operations
  // for this method on a resource or set of resources passed in.
  // ignore the resource if it returns true from the ignore function or does not pass the filter
  // return null if the resource matches the exclude method
  // if the resource matches a mapper that this aggregate mapper contains apply that mapper
  // if the resource does not match a contained mapper run the default function on the resource
  //
  execute(resource){
    if (Array.isArray(resource)){
      return resource.map( r => this.execute(r)).filter(n => n);
    } else {
      if (this.ignore(resource) || !this.filter(resource)){return resource;}
      if (this.exclude(resource)){return null;}
      let mapper = this.mappers.find(map => map.filter(resource));
      if (mapper){
        return mapper.execute(resource);
      } else {
        return this.default(resource);
      }
    }
  }
}

// Mapper that does the actual work of modifying a reasource.  These are the leaf
// nodes of aggregate mappers.  The class contains a filter that must be matched by the
// aggregate mapper and an exec function that will modify the resource.
class FilterMapper {

  constructor(args){
    this.args = args;
    this.filterFn = buildFilter(args.filter);
    this.execfn = buildProcessor(args.exec);
  }

  // if a filter was provided execute that function on the resource otherwise
  // return false
  filter(resource){
    return (this.filterFn) ? this.filterFn(resource) : false;
  }

  execute(resource){
    if (Array.isArray(resource)){
      return resource.map( r => this.execute(r)).filter(n => n);
    }
    return this.execfn(resource);
  }
}

module.exports = {
  AggregateMapper,
  FilterMapper,
  buildFilter
};
