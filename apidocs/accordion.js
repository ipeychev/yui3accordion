/**
 * Provides the Accordion class
 *
 * @module accordion
 */

(function(){

/**
 * Accordion creates an widget, consists of one or more items, which can be collapsed, expanded,
 * set as always visible and reordered by using Drag&Drop. Collapsing/expanding might be animated.
 * 
 * @param _config {Object} Object literal specifying Accordion configuration properties.
 *
 * @class Accordion
 * @constructor
 * @extends Widget
 */

function Accordion( _config ){
    Accordion.superclass.constructor.apply( this, arguments );
}

// Local constants
var Lang  = Y.Lang,
    Node  = Y.Node,
    Anim  = Y.Anim,
    Easing = Y.Easing,
    AccName = "accordion",
    WidgetStdMod = Y.WidgetStdMod,
    QuirksMode = document.compatMode == "BackCompat",
    IEQuirksMode = QuirksMode && Y.UA.ie > 0,
    COLLAPSE_HEIGHT = IEQuirksMode ? 1 : 0,
    getCN = Y.ClassNameManager.getClassName;


/**
 *  Static property provides a string to identify the class.
 *
 * @property Accordion.NAME
 * @type String
 * @static
 */
Accordion.NAME = AccName;

/**
 * Static property used to define the default attribute 
 * configuration for the Accordion.
 * 
 * @property Accordion.ATTRS
 * @type Object
 * @static
 */
Accordion.ATTRS = {
    /**
     * @description The event on which Accordion should listen for user interactions.
     * The value can be also mousedown or mouseup. Mousedown event can be used if
     * drag&drop is not enabled
     *
     * @attribute itemChosen
     * @default click
     * @type String
     */
    itemChosen: {
        value: "click",
        validator: Lang.isString
    },

    /**
     * @description Contains the items, currently added to Accordion
     * 
     * @attribute items
     * @readOnly
     * @default []
     * @type Array
     */
    items: {
        value: [],
        readOnly: true,
        validator: Lang.isArray
    },
    
    /**
     * @attribute resizeEvent
     * 
     * @description The event on which Accordion should listen for resizing.
     * The value must be one of these:
     * <ul>
     *     <li> String "default" - the Accordion will subscribe to Y.windowresize event
     *     </li>
     *     <li> An object in the following form: 
     *         {
     *             sourceObject: some_javascript_object,
     *             resizeEvent: an_event_to_subscribe
     *         }
     *      </li>
     * </ul>
     * For example, if we are using LayoutManager's instance as sourceObject, we will have to use its "resize" event as resizeEvent
     *  
     * @default "default"
     * @type String or Object, see the description above
     */

    resizeEvent: {
        value: "default",
        validator: function( _value ){
            return (Lang.isString(_value) || Lang.isObject(_value));
        }
    },

    /**
     * @attribute useAnimation
     * @description Whether or not Accordion should use animation when expand or collapse some item
     * The animation in Accordion is slow in IE6
     * 
     * @default: true
     * @type boolean
     */
    useAnimation: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute animation
     * @description Animation config values, see Y.Animation
     * 
     * @default <code> {
     *    duration: 1, 
     *    easing: Easing.easeOutStrong
     *  }
     *  </code>
     *  
     * @type Object
     */
    animation: {
        value: {
            duration: 1,
            easing: Easing.easeOutStrong
        },
        validator: function( _value ){
            return Lang.isObject( _value ) && Lang.isNumber( _value.duration ) &&
                Lang.isFunction( _value.easing );
        }
    },

    /**
     * @attribute reorderItems
     * @description Whether or not the items in Accordion can be reordered by using drag&drop
     * 
     * @default true
     * @type boolean
     */
    reorderItems: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute collapseOthersOnExpand
     * @description If true, on item expanding, all other expanded and not set as always visible items, will be collapsed
     * Otherwise, they will stay open
     * 
     * @default true
     * @type Boolean
     */
    collapseOthersOnExpand: {
        value: true,
        validator: Lang.isBoolean
    }
};

/**
 *  Static property to indicate class which will be applied to dd proxy when item is being reordered
 *
 * @property Accordion.C_PROXY_VISIBLE
 * @type String
 * @static
 */
Accordion.C_PROXY_VISIBLE = getCN( AccName, "proxyel", "visible" );


/**
 * Static property, which contains the drag group for Accordion and its items
 *
 * @property Accordion.DRAGGROUP
 * @type String
 * @static
 */
Accordion.DRAGGROUP = "y_accordion";

/**
 * Static property; contains the events, which Accordion publishes
 *
 * @property Accordion.EVENT_TYPES
 * @type Object
 * @static
 */

Accordion.EVENT_TYPES = {

    BEFOREITEMADD: "beforeItemAdd",
    ITEMADDED: "itemAdded",

    BEFOREITEMREMOVE: "beforeItemRemove",
    ITEMREMOVED: "itemRemoved",

    BEFOREITEMERESIZED : "beforeItemResized",
    ITEMERESIZED : "itemResized",

    BEFOREITEMEXPAND  : "beforeItemExpand",
    BEFOREITEMCOLLAPSE : "beforeItemCollapse",
    ITEMEXPANDED : "itemExpanded",
    ITEMCOLLAPSED : "itemCollapsed",    

    BEFOREITEMREORDER : "beforeItemReorder",
    BEFOREENDITEMREORDER : "beforeEndItemReorder",
    ITEMREORDERED : "itemReordered"
};

// Accordion extends Widget

Y.extend( Accordion, Y.Widget, {

    /**
     * Initializer lifecycle implementation for the Accordion class. Publishes events,
     * initializes internal properties and subscribes for resize event.
     *
     * @method initializer
     * @protected
     * @param  _config {Object} Configuration object literal for the Accordion
     */
    initializer: function( _config ) {
        this._initEvents();

        this._lastChild = null;

        this.after( "render", function(){
            var _resizeEvent;

            _resizeEvent = this.get( "resizeEvent" );
            
            this._setUpResizing( _resizeEvent );
            
            this.after( "resizeEventChange", function( _data ) {
                this._setUpResizing( _data.newVal );
            }, this );
        }, this );

        this._forCollapsing = {};
        this._forExpanding  = {};
        this._animations    = {};
    },

    
    /**
     * Destructor lifecycle implementation for the Accordion class.
     * Removes and destroys all registered items.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {
        var _items, _item, i, _length;
        
        _items = this.get( "items" );
        _length = _items.length;
        
        for( i = _length - 1; i >= 0; i-- ){
            _item = _items[ i ];
            
            _items.splice( i, 1 );
            
            this._removeItemHandles( _item );
            
            _item.destroy();
        }
    },

    
    /**
     * Publishes Accordion's events
     *
     * @method _initEvents
     * @protected
     */
    _initEvents: function(){
        var _events = Accordion.EVENT_TYPES;

        /**
         * Signals the beginning of adding an item to the Accordion.
         *
         * @event beforeItemAdd
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being added</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMADD );
        
        /**
         * Signals an item has been added to the Accordion.
         *
         * @event itemAdded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been added</dd>
         *  </dl>
         */
        this.publish( _events.ITEMADDED );
        
        /**
         * Signals the beginning of removing an item.
         *
         * @event beforeItemRemove
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being removed</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMREMOVE );
        
        /**
         * Signals an item has been removed from Accordion.
         *
         * @event itemRemoved
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been removed</dd>
         *  </dl>
         */
        this.publish( _events.ITEMREMOVED );

        /**
         * Signals the beginning of resizing an item.
         *
         * @event beforeItemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being resized</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMERESIZED );
        
        /**
         * Signals an item has been resized.
         *
         * @event itemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been resized</dd>
         *  </dl>
         */
        this.publish( _events.ITEMERESIZED );

        /**
         * Signals the beginning of expanding an item
         *
         * @event beforeItemExpand
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being expanded</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMEXPAND );
        
        /**
         * Signals the beginning of collapsing an item
         *
         * @event beforeItemCollapse
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being collapsed</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMCOLLAPSE );
        
        
        /**
         * Signals an item has been expanded
         *
         * @event itemExpanded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been expanded</dd>
         *  </dl>
         */
        this.publish( _events.ITEMEXPANDED );
        
        /**
         * Signals an item has been collapsed
         *
         * @event itemCollapsed
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been collapsed</dd>
         *  </dl>
         */
        this.publish( _events.ITEMCOLLAPSED );
        
        /**
         * Signals the beginning of reordering an item
         *
         * @event beforeItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMREORDER );
        
        /**
         * Fires before the end of item reordering
         *
         * @event beforeEndItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREENDITEMREORDER );
        
        
        /**
         * Signals an item has been reordered
         *
         * @event itemReordered
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been reordered</dd>
         *  </dl>
         */
        this.publish( _events.ITEMREORDERED );
    },

    
    /**
     * Collection of items handles.
     * Keeps track of each items's event handle, as returned from <code>Y.on</code> or <code>Y.after</code>.
     * @property _itemHandles
     * @private
     * @type Array
     */
    _itemsHandles: {},
    
    
    /**
     * Removes all handles, attched to given item
     *
     * @method _removeItemHandles
     * @protected
     * @param {Y.AccordionItem} _item The item, which handles to remove
     */
    _removeItemHandles: function( _item ){
        var _itemHandles, _itemHandle;
        
        _itemHandles = this._itemsHandles[ _item ];

        for( _itemHandle in _itemHandles ){
            if( _itemHandles.hasOwnProperty( _itemHandle ) ){
                _itemHandle = _itemHandles[ _itemHandle ];
                _itemHandle.detach();
            }
        }

        delete this._itemsHandles[ _item ];
    },
    
    /**
     * Obtains the precise height of the node provided, including padding and border.
     *
     * @method _getNodeOffsetHeight
     * @protected
     * @param {Node|HTMLElement} p_node The node to gather the height from
     * @return {Number} The calculated height or zero in case of failure
     */
    _getNodeOffsetHeight: function( p_node ){
        var _height, _preciseRegion;

        if( p_node instanceof Node ){
            if( p_node.hasMethod( "getBoundingClientRect" ) ){
                _preciseRegion = p_node.invoke( "getBoundingClientRect" );

                if( _preciseRegion ){
                    _height = _preciseRegion.bottom - _preciseRegion.top;

                    return _height;
                }
            } else {
                _height = p_node.get( "offsetHeight" );
                return Y.Lang.isValue( _height ) ? _height : 0;
            }
        } else if( p_node ){
            _height = p_node.offsetHeight;
            return Y.Lang.isValue( _height ) ? _height : 0;
        }

        return 0;
    },


    /**
     * Updates expand and alwaysVisible properties of given item with the values provided.
     * The properties will be updated only if needed.
     *
     * @method _setItemProperties
     * @protected
     * @param {Y.AccordionItem} _item The item, which properties should be updated
     * @param {boolean} _expanding The new value of "expanded" property
     * @param {boolean} _alwaysVisible The new value of "alwaysVisible" property
     */
    _setItemProperties: function( _item, _expanding, _alwaysVisible ){
        var _curAlwaysVisible, _curExpanded;

        _curAlwaysVisible = _item.get( "alwaysVisible" );
        _curExpanded = _item.get( "expanded" );

        if( _expanding != _curExpanded ){
            _item.set( "expanded", _expanding, {
                internalCall: true
            });
        }

        if( _alwaysVisible !== _curAlwaysVisible ){
            _item.set( "alwaysVisible", _alwaysVisible, {
                internalCall: true
            });
        }
    },

    
    /**
     * Updates user interface of an item and marks it as expanded, alwaysVisible or both
     *
     * @method _setItemUI
     * @protected
     * @param {Y.AccordionItem} _item The item, which user interface should be updated
     * @param {boolean} _expanding If true, the item will be marked as expanded.
     * If false, the item will be marked as collapsed
     * @param {boolean} _alwaysVisible If true, the item will be marked as always visible.
     * If false, the always visible mark will be removed
     */
    _setItemUI: function( _item, _expanding, _alwaysVisible ){
        _item.markAsExpanded( _expanding );
        _item.markAsAlwaysVisible( _alwaysVisible );
    },

    
    /**
     * Distributes the involved items as result of user interaction on item header.
     * Some items might be stored in the list for collapsing, other in the list for expanding. 
     * Finally, invokes <code>_processItems</code> function, except if item has been expanded and
     * user has clicked on always visible icon.
     * If the user clicked on close icon, the item will be closed.
     *
     * @method _onItemChosen
     * @protected
     * @param _item {Y.AccordionItem} The item on which user has clicked or pressed key
     * @param _item {Boolean} True if the user has clicked on always visible icon
     * @param _item {Boolean} True if the user has clicked on close icon
     */
    _onItemChosen: function( _item, _srcIconAlwaysVisible, _srcIconClose ){
        var _toBeExcluded, _alwaysVisible, _expanded, _collapseOthersOnExpand;

        _toBeExcluded = {};        
        _collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        _alwaysVisible  = _item.get( "alwaysVisible" );
        _expanded       = _item.get( "expanded" );

        if( _srcIconClose ){
            this.removeItem( _item );
            return;
        } else if( _srcIconAlwaysVisible ){
            if( _expanded ){
                _alwaysVisible = !_alwaysVisible;
                _expanded = _alwaysVisible ? true : _expanded;

                this._setItemProperties( _item, _expanded, _alwaysVisible );
                this._setItemUI( _item, _expanded, _alwaysVisible );

                return;
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: true
                };

                if( _collapseOthersOnExpand ){
                    _toBeExcluded[ _item ] = {
                        item: _item
                    };

                    this._storeItemsForCollapsing( _toBeExcluded );
                }
            }
        } else {
            /*
             * Do the opposite
             */
            if( _expanded ){
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: _alwaysVisible
                };

                if( _collapseOthersOnExpand ){
                    _toBeExcluded[ _item ] = {
                        item: _item
                    };

                    this._storeItemsForCollapsing( _toBeExcluded );
                }
            }
        }

        this._processItems();
    },

    
    /**
     * Helper method to adjust the height of all items, which <code>contentHeight</code> property is set as "stretch".
     * If some item has animation running, it will be stopped before running another one.
     * 
     * @method _adjustStretchItems
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _adjustStretchItems: function(){
        var _items = this.get( "items" ), _heightPerStretchItem;

        _heightPerStretchItem = this._getHeightPerStretchItem();
        
        Y.Array.each( _items, function( _item, _index, _items ){
            var _body, _bodyHeight, _anim, _heightSettings, _expanded;

            _heightSettings = _item.get( "contentHeight" );
            _expanded       = _item.get( "expanded" );

            if( _heightSettings.method === "stretch" && _expanded ){
                _anim = this._animations[ _item ];

                // stop waiting animation
                if( _anim ){
                    _anim.stop();
                }

                _body = _item.getStdModNode( WidgetStdMod.BODY );
                _bodyHeight = this._getNodeOffsetHeight( _body );

                if( _heightPerStretchItem < _bodyHeight ){
                    this._processCollapsing( _item, _heightPerStretchItem );
                } else if( _heightPerStretchItem > _bodyHeight ){
                    this._processExpanding( _item, _heightPerStretchItem );
                }
            }
        }, this );

        return _heightPerStretchItem;
    },

    /**
     * Calculates the height per strech item.
     * 
     * @method _getHeightPerStretchItem
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _getHeightPerStretchItem: function(){
        var _height, _items, _stretchCounter = 0;

        _items = this.get( "items" );
        _height = this.get( "boundingBox" ).get( "clientHeight" );

        Y.Array.each( _items, function( _item, _index, _items ){
            var _collapsed, _itemContentHeight, _header, _heightSettings,
                _headerHeight;

            _header = _item.getStdModNode( WidgetStdMod.HEADER );
            _heightSettings = _item.get( "contentHeight" );
            
            _headerHeight = this._getNodeOffsetHeight( _header );

            _height -= _headerHeight;
            _collapsed = !_item.get( "expanded" );

            if( _collapsed ){
                _height -= COLLAPSE_HEIGHT;
                return;
            }

            if( _heightSettings.method === "stretch" ){
                _stretchCounter++;
            } else {
                _itemContentHeight = this._getItemContentHeight( _item );
                _height -= _itemContentHeight;
            }
        }, this );

        if( _stretchCounter > 0 ){
            _height /= _stretchCounter;
        }

        if( _height < 0 ){
            _height = 0;
        }

        return _height;
    },

    
    /**
     * Calculates the height of given item depending on its "contentHeight" property.
     * 
     * @method _getItemContentHeight
     * @protected
     * @param {Y.AccordionItem} The item, which height should be calculated
     * @return {Number} The calculated item's height
     */
    _getItemContentHeight: function( _item ){
        var _heightSettings, _height = 0, _body, _bodyContent;

        _heightSettings = _item.get( "contentHeight" );

        if( _heightSettings.method === "auto" ){
            _body = _item.getStdModNode( WidgetStdMod.BODY );
            _bodyContent = _body.get( "children" ).item(0);
            _height = _bodyContent ? this._getNodeOffsetHeight( _bodyContent ) : 0;
        } else if( _heightSettings.method === "fixed" ) {
            _height = _heightSettings.height;
        } else {
            _height = this._getHeightPerStretchItem();
        }

        return _height;
    },

    
    /**
     * Stores all items, which are expanded and not set as always visible in list
     * in order to be collapsed later.
     * 
     * @method _storeItemsForCollapsing
     * @protected
     * @param {Object} _itemsToBeExcluded (optional) Contains one or more <code>Y.AccordionItem</code> instances,
     * which should be not included in the list
     */
    _storeItemsForCollapsing: function( _itemsToBeExcluded ){
        _itemsToBeExcluded = _itemsToBeExcluded || {};
        var _items = this.get( "items" );

        Y.Array.each( _items, function( _item, _index, _items ){
            var _expanded, _alwaysVisible;

            _expanded = _item.get( "expanded" );
            _alwaysVisible = _item.get( "alwaysVisible" );

            if( _expanded && !_alwaysVisible && !_itemsToBeExcluded[ _item ] ){
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            }
        }, this );
    },

    
    /**
     * Expands an item to given height. This includes also an update to item's user interface
     * 
     * @method _expandItem
     * @protected
     * @param {Y.AccordionItem} _item The item, which should be expanded
     * @param {Number} _height The height to which we should expand the item
     */
    _expandItem: function( _item, _height ){
        var _alwaysVisible = _item.get( "alwaysVisible" );

        this._processExpanding( _item, _height );
        this._setItemUI( _item, true, _alwaysVisible );
    },

    
    /**
     * Expands an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of expanding might be animated. This setting will be ignored, if <code>_forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processExpanding
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be expanded
     * @param {Boolean} _forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     * @param {Number} _height The height to which item should be expanded
     */
    _processExpanding: function( _item, _height, _forceSkipAnimation ){
        var _anim, _curAnim, _animSettings, _expanding = false,
            _events = Accordion.EVENT_TYPES,
            _accAnimationSettings, _body;

        
        function _onExpandComplete(){
            delete this._animations[ _item ];
            _anim = null;

            _item.markAsExpanding( false );

            this.fire( _events.ITEMERESIZED, {
                item : _item
            });

            if( _expanding ){
                this.fire( _events.ITEMEXPANDED, {
                    item: _item
                });
            }
        }

        
        _body = _item.getStdModNode( WidgetStdMod.BODY );

        this.fire( _events.BEFOREITEMERESIZED, {
            item: _item
        });

        if( _body.get( "clientHeight" ) <= 0 ){
            _expanding = true;
            this.fire( _events.BEFOREITEMEXPAND, {
                item: _item
            });
        }

        if( !_forceSkipAnimation && this.get( "useAnimation" ) ){
            _animSettings = _item.get( "animation" ) || {};

            _anim = new Anim( {
                node: _body,
                to: {
                    height: _height
                }
            });

            _anim.on( "end", _onExpandComplete, this );

            _accAnimationSettings = this.get( "animation" );

            _anim.set( "duration", _animSettings.duration || _accAnimationSettings.duration );
            _anim.set( "easing"  , _animSettings.easing   || _accAnimationSettings.easing   );
            
            _curAnim = this._animations[ _item ];
            
            if( _curAnim ){
                _curAnim.stop();
            }

            _item.markAsExpanding( true );

            this._animations[ _item ] = _anim;

            _anim.run();
        } else {
            _body.setStyle( "height", _height + "px" );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _expanding ){
                this.fire( _events.ITEMEXPANDED, {
                    item: _item
                });
            }
        }
    },

    
    /**
     * Collapse an item and update its user interface
     * 
     * @method _collapseItem
     * @protected
     * @param {Y.AccordionItem} _item The item, which should be collapsed
     */
    _collapseItem: function( _item ){
        this._processCollapsing( _item, COLLAPSE_HEIGHT );
        this._setItemUI( _item, false, false );
    },

    
    /**
     * Collapse an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of collapsing might be animated. This setting will be ignored, if <code>_forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processCollapsing
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be collapsed
     * @param {Number} _height The height to which item should be collapsed
     * @param {Boolean} _forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     */
    _processCollapsing: function( _item, _height, _forceSkipAnimation ){
        var _anim, _curAnim, animSettings, _accAnimationSettings, _events, _body, 
            _collapsing = (_height === COLLAPSE_HEIGHT);
            
        _events = Accordion.EVENT_TYPES;
        _body = _item.getStdModNode( WidgetStdMod.BODY );
        

        function _onCollapseComplete(){
            delete this._animations[ _item ];
            _anim = null;

            _item.markAsCollapsing( false );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _collapsing ){
                this.fire( _events.ITEMCOLLAPSED, {
                    item: _item
                });
            }
        }

        
        this.fire( _events.BEFOREITEMERESIZED, {
            item: _item
        });

        if( _collapsing ){
            this.fire( _events.BEFOREITEMCOLLAPSE, {
                item: _item
            });
        }

        if( !_forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = _item.get( "animation" ) || {};

            _anim = new Anim( {
                node: _body,
                to: {
                    height: _height
                }
            });

            _anim.on( "end", _onCollapseComplete, this );

            _accAnimationSettings = this.get( "animation" );

            _anim.set( "duration", animSettings.duration || _accAnimationSettings.duration );
            _anim.set( "easing"  , animSettings.easing   || _accAnimationSettings.easing );

            _curAnim = this._animations[ _item ];
            
            if( _curAnim ){
                _curAnim.stop();
            }
            
            _item.markAsCollapsing( true );

            this._animations[ _item ] = _anim;

            _anim.run();
        } else {
            _body.setStyle( "height", _height + "px" );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _height === 0 ){
                this.fire( _events.ITEMCOLLAPSED, {
                    item: _item
                });
            }
        }
    },

    
    /**
     * Make an item draggable. The item can be reordered later.
     * 
     * @method _initItemDragDrop
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be set as draggable
     */
    _initItemDragDrop: function( _item ){
        var _itemHeader, _dd, _bb, _itemBB, _ddrop;

        _itemHeader = _item.getStdModNode( WidgetStdMod.HEADER );

        if( _itemHeader.dd ){
            return;
        }


        _bb = this.get( "boundingBox" );
        _itemBB = _item.get( "boundingBox" );

        _dd = new Y.DD.Drag({
            node: _itemHeader,
            groups: [ Accordion.DRAGGROUP ]
        }).plug(Y.Plugin.DDProxy, {
            moveOnEnd: false
        }).plug(Y.Plugin.DDConstrained, {
            constrain2node: _bb
        });

        _ddrop = new Y.DD.Drop({
            node: _itemBB,
            groups: [ Accordion.DRAGGROUP ]
        });

        _dd.on( "drag:start", function(e){
            var _dragNode, _events, _item;
            
            _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );
            _events = Accordion.EVENT_TYPES;
            _dragNode = _dd.get( "dragNode" );

            _dragNode.addClass( Accordion.C_PROXY_VISIBLE );
            _dragNode.set( "innerHTML", _item.get( "label" ) );
            
            return this.fire( _events.BEFOREITEMREORDER, { item: _item } );
        }, this );

        _dd.on( "drag:end", function(e){
            var _dragNode, _events, _item;

             _events = Accordion.EVENT_TYPES;
            _dragNode = _dd.get( "dragNode" );

            _dragNode.removeClass( Accordion.C_PROXY_VISIBLE );
            _dragNode.set( "innerHTML", "" );
            
            _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );
            return this.fire( _events.BEFOREENDITEMREORDER, { item: _item } );
        }, this );
        
        
        _dd.after( "drag:end", function(e){
            var _events, _item, _data;
            
            _events = Accordion.EVENT_TYPES;

            _data = _dd.get( "data" );
            
            if( _data.drophit ){
                _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );

                _dd.set( "data", {
                    drophit: false
                } );

                return this.fire( _events.ITEMREORDERED, { item: _item } );
            }
            
            return true;
        }, this );


        _dd.on('drag:drophit', function(e) {
            var _mineIndex, _targetItemIndex, _targetItemBB, _itemBB, _cb, 
                _goingUp, _items, _targetItem;

            _targetItem = this.getItem( e.drop.get( "node" ) );

            if( _targetItem === _item ){
                return false;
            }

            _mineIndex = this.getItemIndex( _item );
            _targetItemIndex = this.getItemIndex( _targetItem );
            _targetItemBB = _targetItem.get( "boundingBox" );
            _itemBB = _item.get( "boundingBox" );
            _cb = this.get( "contentBox" );
            _goingUp = false;
            _items = this.get( "items" );

            if( _targetItemIndex < _mineIndex ){
                _goingUp = true;
            }

            _cb.removeChild( _itemBB );

            if( _goingUp ){
                _cb. insertBefore( _itemBB, _targetItemBB );
                _items.splice( _mineIndex, 1 );
                _items.splice( _targetItemIndex, 0, _item );
            } else {
                _cb. insertBefore( _itemBB, _targetItemBB.next( Y.AccordionItem.C_ITEM ) );
                _items.splice( _targetItemIndex + 1, 0, _item );
                _items.splice( _mineIndex, 1 );
            }
            
            _dd.set( "data", {
                drophit: true
            });
            
            return true;
        }, this );

    },

    
    /**
     * Process items as result of user interaction or properties change.
     * This includes four steps:
     * 1. Update the properties of the items
     * 2. Collapse all items stored in the list for collapsing
     * 3. Adjust all stretch items
     * 4. Expand items stored in the list for expanding
     * 
     * @method _processItems
     * @protected
     */
    _processItems: function(){
        var _forCollapsing, _forExpanding, _itemCont, _heightPerStretchItem, 
            _height, _heightSettings, _item;

        _forCollapsing = this._forCollapsing;
        _forExpanding  = this._forExpanding;

        this._setItemsProperties();

        for( _item in _forCollapsing ){
            if( _forCollapsing.hasOwnProperty( _item ) ){
                _itemCont = _forCollapsing[ _item ];

                this._collapseItem( _itemCont.item );
            }
        }

        _heightPerStretchItem = this._adjustStretchItems();

        for( _item in _forExpanding ){
            if( _forExpanding.hasOwnProperty( _item ) ){
                _itemCont = _forExpanding[ _item ];
                _item = _itemCont.item;
                _height = _heightPerStretchItem;
                _heightSettings = _item.get( "contentHeight" );

                if( _heightSettings.method !== "stretch" ){
                    _height = this._getItemContentHeight( _item );
                }

                this._expandItem( _item, _height );
            }
        }

        this._forCollapsing = {};
        this._forExpanding  = {};
    },

    
    /**
     * Update properties of items, which were stored in the lists for collapsing or expanding
     * 
     * @method _setItemsProperties
     * @protected
     */
    _setItemsProperties: function (){
        var _forCollapsing, _forExpanding, _itemData;

        _forCollapsing = this._forCollapsing;
        _forExpanding = this._forExpanding;

        for( _itemData in _forCollapsing ){
            if( _forCollapsing.hasOwnProperty( _itemData ) ){
                _itemData = _forCollapsing[_itemData];
                this._setItemProperties( _itemData.item, false, false );
            }
        }

        for( _itemData in _forExpanding ){
            if( _forExpanding.hasOwnProperty( _itemData ) ){
                _itemData = _forExpanding[_itemData];
                this._setItemProperties( _itemData.item, true, _itemData.alwaysVisible );
            }
        }
    },


    /**
     * Handles the change of "expand" property of given item
     * 
     * @method _afterItemExpand
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterItemExpand: function( _params ){
        var _expanded, _item, _alwaysVisible, _collapseOthersOnExpand;

        if( _params.internalCall ){
            return;
        }
        
        _expanded = _params.newVal;
        _item     = _params.currentTarget;
        _alwaysVisible = _item.get( "alwaysVisible" );
        _collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        
        if( _expanded ){
            this._forExpanding[ _item ] = {
                item: _item,
                alwaysVisible: _alwaysVisible
            };
            
            if( _collapseOthersOnExpand ){
                this._storeItemsForCollapsing();
            }
        } else {
            this._forCollapsing[ _item ] = {
                item: _item
            };
        }
        
        this._processItems();
    },

    /**
     * Handles the change of "alwaysVisible" property of given item
     * 
     * @method _afterItemAlwaysVisible
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterItemAlwaysVisible: function( _params ){
        var _item, _alwaysVisible, _expanded;
        
        if( _params.internalCall ){
            return;
        }

        _alwaysVisible = _params.newVal;
        _item          = _params.currentTarget;
        _expanded      = _item.get( "expanded" );

        if( _alwaysVisible ){
            if( _expanded ){
                this._setItemProperties( _item, true, true );
                this._setItemUI( _item, true, true );
                return;
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: true
                };

                this._storeItemsForCollapsing();
            }
        } else {
            if( _expanded ){
                this._setItemUI( _item, true, false );
                return;
            } else {
                return;
            }
        }
        
        this._processItems();
    },
    
    
    /**
     * Handles the change of "contentHeight" property of given item
     * 
     * @method _afterContentHeight
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterContentHeight: function( _params ){
        var _item, _itemContentHeight, _body, _bodyHeight, _expanded;
        
        _item = _params.currentTarget;
        
        this._adjustStretchItems();
        
        if( _params.newVal.method !== "stretch" ){
            _expanded = _item.get( "expanded" );
            _itemContentHeight = this._getItemContentHeight( _item );
            
            _body = _item.getStdModNode( WidgetStdMod.BODY );
            _bodyHeight = this._getNodeOffsetHeight( _body );
            
            if( _itemContentHeight < _bodyHeight ){
                this._processCollapsing( _item, _itemContentHeight, !_expanded );
            } else if( _itemContentHeight > _bodyHeight ){
                this._processExpanding( _item, _itemContentHeight, !_expanded );
            }
        }
    },
    
    
    
    /**
     * Subscribe for resize event, which could be provided from the browser or from an arbitrary object.
     * For example, if there is LayoutManager in the page, it is preferable to subscribe to its resize event,
     * instead to those, which browser provides.
     * 
     * @method _setUpResizing
     * @protected
     * @param {String|Object} String "default" or object with the following properties:
     *  <dl>
     *      <dt>sourceObject</dt>
     *          <dd>An abbitrary object</dd>
     *      <dt>resizeEvent</dt>
     *          <dd>The name of its resize event</dd>
     *  </dl>
     */
    _setUpResizing: function( _value ){
        if( this._resizeEventHandle ){
            this._resizeEventHandle.detach();
        }

        if( _value === "default" ){
            this._resizeEventHandle = Y.on( 'windowresize', this._adjustStretchItems, this );
        } else {
            this._resizeEventHandle = _value.sourceObject.on( _value.resizeEvent, this._adjustStretchItems, this );
        }
    },

    
    /**
     * Creates one or more items found in Accordion's <code>contentBox</code>
     * 
     * @method renderUI
     * @protected
     */
    renderUI: function(){
        var _cb, _itemsDom;

        _cb = this.get( "contentBox" );
        _itemsDom = _cb.queryAll( "> div." + Y.AccordionItem.C_ITEM );

        _itemsDom.each( function( _itemNode, _index, _itemsDom ){
            var _newItem;

            if( !this.getItem( _itemNode ) ){
                _newItem = new Y.AccordionItem({
                    contentBox: _itemNode
                });

                this.addItem( _newItem );
            }
        }, this );
    },

    
    /**
     * Add listener to <code>itemChosen</code> and <code>keypress</code> events in Accordion's content box
     * 
     * @method bindUI
     * @protected
     */
    bindUI: function(){
        var _contentBox, _itemChosenEvent, _header, _itemNode, _item, _iconAlwaysVisible,
            _iconClose, _srcIconAlwaysVisible, _srcIconExtended, _srcIconClose, _iconExtended;

        _contentBox = this.get( 'contentBox' );
        _itemChosenEvent = this.get( 'itemChosen' );
        
        _contentBox.delegate( _itemChosenEvent, function(e){
            _header = e.currentTarget;
            _itemNode = _header.get( "parentNode" );
            _item = this.getItem( _itemNode );
            _iconAlwaysVisible = _item.get( "iconAlwaysVisible" );
            _iconClose = _item.get( "iconClose" );
            _srcIconAlwaysVisible = (_iconAlwaysVisible === e.target);
            _srcIconClose = (_iconClose === e.target);

            this._onItemChosen( _item, _srcIconAlwaysVisible, _srcIconClose );
        }, 'div.yui-widget-hd', this );


        _contentBox.delegate( "keypress", function(e){
            var _charCode, _target = e.target;
            
            _charCode = e.charCode;

            if( _charCode === 13 ){
                _header = e.currentTarget;
                _itemNode = _header.get( "parentNode" );
                _item = this.getItem( _itemNode );

                _iconAlwaysVisible = _item.get( "iconAlwaysVisible" );
                _iconExtended = _item.get( "iconExtended" );
                _iconClose = _item.get( "iconClose" );
                _srcIconAlwaysVisible = (_iconAlwaysVisible === _target);
                _srcIconExtended = (_iconExtended === _target );
                _srcIconClose = (_iconClose === e.target);

                /**
                 * Exclude label in order to avoid double function invocation.
                 * Label keypress will be managed in "click" listener.
                 */
                if( _srcIconExtended || _srcIconAlwaysVisible  || _srcIconClose ){
                    this._onItemChosen( _item, _srcIconAlwaysVisible, _srcIconClose );
                }
            }
        }, 'div.yui-widget-hd', this );
    },

    
    /**
     * Add an item to Accordion. Items could be added/removed multiple times and they
     * will be rendered in the process of adding, if not.
     * The item will be expanded, collapsed, or set as always visible depending on the 
     * settings. Item's properties will be also updated, if they are incomplete.
     * For example, if <code>alwaysVisible</code> is true, but <code>expanded</code>
     * property is false, it will be set to true also.
     * 
     * If the second param, <code>_parentItem</code> is an <code>Y.AccordionItem</code> instance,
     * registered in Accordion, the item will be added as child of the <code>_parentItem</code>
     * 
     * @method addItem
     * @param {Y.AccordionItem} _item The item to be added in Accordion
     * @param {Y.AccordionItem} _parentItem (optional) This item will be the parent of the item being added
     * 
     * @return Boolean True in case of successfully added item, false otherwise
     */
    addItem: function( _item, _parentItem ){
        
        function _addItem( _item ){
            var _expanded, _alwaysVisible;
            
            _expanded = _item.get( "expanded" );
            _alwaysVisible = _item.get( "alwaysVisible" );

            _expanded = _expanded || _alwaysVisible;

            if( _expanded ){
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: _alwaysVisible
                };
            } else {
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            }

            this._processItems();
        }

        var _bodyContent, _itemIndex, _items, _contentBox, _itemHandles,
        _itemContentBox, _events, _res, _cb, _children, _itemBoundingBox;

        _events = Accordion.EVENT_TYPES;

        _res = this.fire( _events.BEFOREITEMADD, {
            item: _item
        });

        if( !_res ){
            return false;
        }

        _items = this.get( "items" );
        _contentBox = this.get( 'contentBox' );

        _itemContentBox   = _item.get( 'contentBox' );
        _itemBoundingBox  = _item.get( 'boundingBox' );

        if( !_itemContentBox.inDoc() ){
            if( _parentItem ){
                _itemIndex = this.getItemIndex( _parentItem );

                if( _itemIndex < 0 ){
                    return false;
                }

                _items.splice( _itemIndex, 0, _item );

                if( _item.get( "rendered" ) ){
                    _contentBox.insertBefore( _itemBoundingBox, _parentItem.get( 'boundingBox' ) );
                } else {
                    _contentBox.insertBefore( _itemContentBox, _parentItem.get( 'boundingBox' ) );
                }
            } else {
                _items.push( _item );

                if( _item.get( "rendered" ) ){
                    _contentBox.insertBefore( _itemBoundingBox, null );
                } else {
                    _contentBox.insertBefore( _itemContentBox, null );
                }
            }
        } else {
            _cb = this.get( "contentBox" );
            _children = _cb.get( "children" );

            _res = _children.some( function( _node, _index, _nodeList ){
                if( _node === _itemContentBox ){
                    _items.splice( _index, 0, _item );
                    return true;
                } else {
                    return false;
                }
            }, this );

            if( !_res ){
                return false;
            }
        }

        _bodyContent = _item.get( "bodyContent" );

        if( !_bodyContent ){
            _item.set( "bodyContent", "&nbsp;" );
        }

        if( !_item.get( "rendered" ) ){
            _item.render();
        }
        
        _addItem.call( this, _item );

        if( this.get( "reorderItems" ) ){
            this._initItemDragDrop( _item );
        }
        
        _itemHandles = this._itemsHandles[ _item ];
        
        if( !_itemHandles ){
            _itemHandles = {};
        }
        
        _itemHandles = {
            "expandedChange" : _item.after( "expandedChange", this._afterItemExpand, this ),
            "alwaysVisibleChange" : _item.after( "alwaysVisibleChange", this._afterItemAlwaysVisible, this ),
            "contentHeightChange" : _item.after( "contentHeightChange", this._afterContentHeight, this )
        };
        
        this._itemsHandles[ _item ] = _itemHandles;

        this.fire( _events.ITEMADDED, {
            item: _item
        });

        return true;
    },

    
    /**
     * Removes an previously registered item in Accordion
     * 
     * @method removeItem
     * @param {Y.AccordionItem|Number} p_item The item to be removed, or its index
     * @return Y.AccordionItem The removed item or null if not found
     */
    removeItem: function( p_item ){
        var _items, _bb, _item = null, _itemIndex, _events;
        
         _events = Accordion.EVENT_TYPES;
        
        _items = this.get( "items" );
        
        if( Lang.isNumber( p_item ) ){
            _itemIndex = p_item;
        } else if( p_item instanceof Y.AccordionItem ){
            _itemIndex = this.getItemIndex( p_item );
        } else {
            return null;
        }

        if( _itemIndex >= 0 ){
            
            this.fire( _events.BEFOREITEMREMOVE, {
                item: p_item
            });

            _item = _items.splice( _itemIndex, 1 )[0];

            this._removeItemHandles( _item );
            
            _bb = _item.get( "boundingBox" );
            _bb.remove();

            this._adjustStretchItems();
            
            this.fire( _events.ITEMREMOVED, {
                item: p_item
            });
        }

        return _item;
    },

    
    /**
     * Searching for item, previously registered in Accordion
     * 
     * @method getItem
     * @param {Number|Y.Node} _param If number, this must be item's index.
     * If Node, it should be the value of item's <code>contentBox</code> or <code>boundingBox</code> properties
     * 
     * @return Y.AccordionItem The found item or null
     */
    getItem: function( _param ){
        var _items = this.get( "items" ), _item = null;

        if( Lang.isNumber( _param ) ){
            _item = _items[ _param ];

            return (_item instanceof Y.AccordionItem) ? _item : null;
        } else if( _param instanceof Node ){

            Y.Array.some( _items, function( _tmpItem, _index, _items ){
                var _contentBox, _boundingBox;
                
                _contentBox = _tmpItem.get( "contentBox" );
                _boundingBox = _tmpItem.get( "boundingBox" );

                if( _contentBox === _param ){
                    _item = _tmpItem;
                    return true;
                } else if( _boundingBox === _param ){
                    _item = _tmpItem;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return _item;
    },

    
    /**
     * Looking for the index of previously registered item
     * 
     * @method getItemIndex
     * @param {Y.AccordionItem} _item The item which index should be returned
     * @return Number Item index or <code>-1</code> if item has been not found
     */
    getItemIndex: function( _item ){
        var _res = -1, _items;

        if( _item instanceof Y.AccordionItem ){
            _items = this.get( "items" );

            Y.Array.some( _items, function( _tmpItem, _index, _items ){
                if( _tmpItem === _item ){
                    _res = _index;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return _res;
    }
    
});

Y.Accordion = Accordion;

}());

